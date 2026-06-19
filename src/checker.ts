import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeAliasDecl, TypeRef } from "./ast.ts";
import type { ResolvedProgram } from "./rast.ts";
import type { TypedProgram, TypeName } from "./tast.ts";
import { primitiveTypes } from "./token.ts";
import { typeName } from "./type_ref.ts";

type Str = string;
type i32 = number;
type b8 = boolean;
type usize = number;

interface LocalInfo {
  type: TypeName;
  mutable: b8;
}

export type CheckedProgram = TypedProgram;

const numericTypes = new Set<Str>(["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "usize", "f32", "f64"]);

export function check(program: ResolvedProgram): CheckedProgram {
  const checker = new Checker(program);
  return checker.check();
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private functions = new Map<Str, FunctionDecl>();
  private typeAliases = new Map<Str, TypeRef>();
  private expressionTypes = new Map<Str, { type: TypeName }>();

  constructor(private program: ResolvedProgram) {}

  check(): CheckedProgram {
    this.collectFunctions();
    for (const fn of this.program.functions) this.checkFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { ...this.program, expressionTypes: this.expressionTypes };
  }

  private collectFunctions(): void {
    for (const typeAlias of this.program.typeAliases) this.typeAliases.set(typeAlias.name, typeAlias.type);
    for (const typeAlias of this.program.typeAliases) {
      if (typeAlias.type.kind !== "RecordTypeRef") this.error(`Type alias '${typeAlias.name}' must name a record type`, typeAlias.span);
      this.checkType(typeAlias.type);
    }
    this.checkTypeAliasOrder();
    for (const fn of this.program.functions) {
      this.functions.set(fn.name, fn);
      this.checkType(fn.returnType);
      for (const param of fn.params) {
        this.checkType(param.type);
        this.checkValueType(param.type, `Parameter '${param.name}' cannot have type 'void'`, param.span);
        this.checkParamType(param, fn.name);
      }
    }
  }

  private checkTypeAliasOrder(): void {
    const indexes = new Map<Str, i32>();
    for (let index = 0; index < this.program.typeAliases.length; index++) indexes.set(this.program.typeAliases[index]!.name, index as i32);
    for (let index = 0; index < this.program.typeAliases.length; index++) this.checkTypeAliasDeps(this.program.typeAliases[index]!, index as i32, indexes);
  }

  private checkTypeAliasDeps(typeAlias: TypeAliasDecl, index: i32, indexes: Map<Str, i32>): void {
    for (const name of collectTypeAliasRefs(typeAlias.type)) {
      const refIndex = indexes.get(name);
      if (refIndex === undefined || refIndex < index) continue;
      this.error(`Type alias '${typeAlias.name}' cannot depend on '${name}' before it is declared`, typeAlias.span);
    }
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = new Map<Str, LocalInfo>();
    for (const param of fn.params) locals.set(param.name, { type: typeName(param.type), mutable: false });

    const returnType = typeName(fn.returnType);
    if (parseArrayType(returnType)) this.error(`Function '${fn.name}' cannot return array type '${returnType}'`, fn.returnType.span);
    if (fn.external) this.checkCAbiFunction(fn, "Extern");
    else if (fn.exported) this.checkCAbiFunction(fn, "Exported");
    if (fn.name === "main") this.checkMainFunction(fn, returnType);
    if (!fn.body) return;
    for (const stmt of fn.body.statements) this.checkStatement(stmt, locals, returnType);
    if (returnType !== "void" && !blockReturns(fn.body.statements)) this.error(`Function '${fn.name}' must return '${returnType}'`, fn.span);
  }

  private checkStatement(stmt: Statement, locals: Map<Str, LocalInfo>, returnType: TypeName): void {
    switch (stmt.kind) {
      case "ReturnStmt":
        this.checkReturn(stmt.expression, locals, returnType, stmt.span);
        return;
      case "VarDeclStmt":
        this.checkVarDecl(stmt, locals);
        return;
      case "AssignmentStmt":
        this.checkAssignment(stmt, locals);
        return;
      case "WhileStmt":
        this.checkWhile(stmt, locals, returnType);
        return;
      case "IfStmt":
        this.checkIf(stmt, locals, returnType);
        return;
    }
  }

  private checkReturn(expr: Expression | null, locals: Map<Str, LocalInfo>, expected: TypeName, span: SourceSpan): void {
    if (!expr) {
      if (expected !== "void") this.error(`Function must return '${expected}'`, span);
      return;
    }
    if (expected === "void") {
      this.error("Void function cannot return a value", span);
      return;
    }
    const actual = this.typeOfExpected(expr, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Return type '${actual}' is not assignable to '${expected}'`, span);
  }

  private checkVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, locals: Map<Str, LocalInfo>): void {
    this.checkType(stmt.type);
    this.checkValueType(stmt.type, `Variable '${stmt.name}' cannot have type 'void'`, stmt.span);
    const expected = typeName(stmt.type);
    const actual = this.typeOfExpected(stmt.initializer, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Initializer type '${actual}' is not assignable to '${expected}'`, stmt.span);
    locals.set(stmt.name, { type: actual, mutable: stmt.mutable });
  }

  private checkAssignment(stmt: Extract<Statement, { kind: "AssignmentStmt" }>, locals: Map<Str, LocalInfo>): void {
    const local = locals.get(stmt.name);
    if (!local) return;
    if (!local.mutable) this.error(`Cannot assign to const '${stmt.name}'`, stmt.span);
    if (parseArrayType(local.type)) this.error(`Cannot assign to array variable '${stmt.name}'`, stmt.span);
    const actual = this.typeOfExpected(stmt.expression, locals, local.type);
    if (!isAssignable(actual, local.type)) this.error(`Assignment type '${actual}' is not assignable to '${local.type}'`, stmt.span);
  }

  private checkWhile(stmt: Extract<Statement, { kind: "WhileStmt" }>, locals: Map<Str, LocalInfo>, returnType: TypeName): void {
    const condition = this.typeOf(stmt.condition, locals);
    if (condition !== "bool") this.error(`While condition type '${condition}' is not assignable to 'bool'`, stmt.condition.span);
    for (const child of stmt.body.statements) this.checkStatement(child, locals, returnType);
  }

  private checkIf(stmt: Extract<Statement, { kind: "IfStmt" }>, locals: Map<Str, LocalInfo>, returnType: TypeName): void {
    const condition = this.typeOf(stmt.condition, locals);
    if (condition !== "bool") this.error(`If condition type '${condition}' is not assignable to 'bool'`, stmt.condition.span);
    for (const child of stmt.thenBody.statements) this.checkStatement(child, locals, returnType);
    for (const child of stmt.elseBody?.statements ?? []) this.checkStatement(child, locals, returnType);
  }

  private typeOf(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    const type = this.computeType(expr, locals);
    this.expressionTypes.set(spanKey(expr.span), { type });
    return type;
  }

  private typeOfExpected(expr: Expression, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    if (expr.kind === "IntegerLiteral" && isIntegerType(expected)) {
      this.expressionTypes.set(spanKey(expr.span), { type: expected });
      return expected;
    }
    if (expr.kind === "FloatLiteral" && isFloatType(expected)) {
      this.expressionTypes.set(spanKey(expr.span), { type: expected });
      return expected;
    }
    if (expr.kind === "RecordLiteralExpr") {
      const type = this.recordLiteralType(expr, locals, expected);
      this.expressionTypes.set(spanKey(expr.span), { type });
      return type;
    }
    if (expr.kind === "ArrayLiteralExpr") {
      const type = this.arrayLiteralType(expr, locals, expected);
      this.expressionTypes.set(spanKey(expr.span), { type });
      return type;
    }
    return this.typeOf(expr, locals);
  }

  private computeType(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    switch (expr.kind) {
      case "IntegerLiteral":
        return "i32";
      case "FloatLiteral":
        return "f64";
      case "BoolLiteral":
        return "bool";
      case "IdentifierExpr":
        return this.identifierType(expr.name, locals, expr.span);
      case "BinaryExpr":
        return this.binaryType(expr, locals);
      case "CallExpr":
        return this.callType(expr, locals);
      case "PostfixPointerExpr":
        return this.postfixPointerType(expr, locals);
      case "FieldAccessExpr":
        return this.fieldAccessType(expr, locals);
      case "RecordLiteralExpr":
        this.error("Record literals require an expected record type", expr.span);
        return "<error>";
      case "ArrayLiteralExpr":
        this.error("Array literals require an expected array type", expr.span);
        return "<error>";
      case "IndexExpr":
        return this.indexType(expr, locals);
    }
  }

  private identifierType(name: Str, locals: Map<Str, LocalInfo>, span: SourceSpan): TypeName {
    const local = locals.get(name);
    if (local) return local.type;
    this.error(`Unknown identifier '${name}'`, span);
    return "<error>";
  }

  private binaryType(expr: Extract<Expression, { kind: "BinaryExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const hinted = this.binaryOperandTypes(expr, locals);
    if (hinted.left !== hinted.right) {
      this.error(`Cannot apply '${expr.operator}' to '${hinted.left}' and '${hinted.right}'`, expr.span);
      return "<error>";
    }
    if (!numericTypes.has(hinted.left)) this.error(`Operator '${expr.operator}' requires numeric operands`, expr.span);
    if (isComparisonOperator(expr.operator)) return "bool";
    return hinted.left;
  }

  private binaryOperandTypes(expr: Extract<Expression, { kind: "BinaryExpr" }>, locals: Map<Str, LocalInfo>): { left: TypeName; right: TypeName } {
    const left = this.typeOf(expr.left, locals);
    const right = this.typeOfExpected(expr.right, locals, left);
    if (left === right) return { left, right };
    if (expr.left.kind === "IntegerLiteral" || expr.left.kind === "FloatLiteral") return { left: this.typeOfExpected(expr.left, locals, right), right };
    return { left, right };
  }

  private callType(expr: Extract<Expression, { kind: "CallExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const fn = this.functions.get(expr.callee);
    if (!fn) {
      this.error(`Unknown function '${expr.callee}'`, expr.span);
      return "<error>";
    }

    this.checkCallArgs(expr.args, fn, locals, expr.span);
    return typeName(fn.returnType);
  }

  private checkCallArgs(args: Expression[], fn: FunctionDecl, locals: Map<Str, LocalInfo>, span: SourceSpan): void {
    if (args.length !== fn.params.length) this.error(`Function '${fn.name}' expects ${fn.params.length} arguments, got ${args.length}`, span);
    const count = Math.min(args.length, fn.params.length) as i32;
    for (let index = 0; index < count; index++) this.checkCallArg(args[index]!, fn, locals, index);
  }

  private checkCallArg(arg: Expression, fn: FunctionDecl, locals: Map<Str, LocalInfo>, index: i32): void {
    const expected = typeName(fn.params[index]!.type);
    const actual = this.typeOfExpected(arg, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`, arg.span);
  }

  private fieldAccessType(expr: Extract<Expression, { kind: "FieldAccessExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const record = this.recordAlias(operand);
    if (!record) {
      this.error(`Cannot access field '${expr.field}' on non-record type '${operand}'`, expr.span);
      return "<error>";
    }
    const field = record.fields.find((candidate) => candidate.name === expr.field);
    if (!field) {
      this.error(`Unknown field '${expr.field}' on type '${operand}'`, expr.span);
      return "<error>";
    }
    return typeName(field.type);
  }

  private recordLiteralType(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    const record = this.recordAlias(expected);
    if (!record) {
      this.error(`Record literal is not assignable to non-record type '${expected}'`, expr.span);
      return "<error>";
    }
    this.checkRecordLiteralFields(expr, locals, expected, record);
    return expected;
  }

  private checkRecordLiteralFields(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName, record: RecordTypeRef): void {
    const seen = new Set<Str>();
    for (const field of expr.fields) {
      if (seen.has(field.name)) this.error(`Duplicate field '${field.name}'`, field.span);
      seen.add(field.name);
      const expectedField = record.fields.find((candidate) => candidate.name === field.name);
      if (!expectedField) {
        this.error(`Unknown field '${field.name}' on type '${expected}'`, field.span);
        continue;
      }
      const actual = this.typeOfExpected(field.expression, locals, typeName(expectedField.type));
      const expectedType = typeName(expectedField.type);
      if (!isAssignable(actual, expectedType)) this.error(`Field '${field.name}' type '${actual}' is not assignable to '${expectedType}'`, field.span);
    }
    for (const field of record.fields) {
      if (!seen.has(field.name)) this.error(`Missing field '${field.name}' on type '${expected}'`, expr.span);
    }
  }

  private recordAlias(name: TypeName): RecordTypeRef | null {
    const type = this.typeAliases.get(name);
    if (type?.kind === "RecordTypeRef") return type;
    return null;
  }

  private arrayLiteralType(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    const array = parseArrayType(expected);
    if (!array) {
      this.error(`Array literal is not assignable to non-array type '${expected}'`, expr.span);
      return "<error>";
    }
    for (const element of expr.elements) {
      const actual = this.typeOfExpected(element, locals, array.element);
      if (!isAssignable(actual, array.element)) this.error(`Array element type '${actual}' is not assignable to '${array.element}'`, element.span);
    }
    if (array.length !== null && array.length !== expr.elements.length) this.error(`Array length ${expr.elements.length} is not assignable to '${expected}'`, expr.span);
    return `${array.element}[${expr.elements.length}]`;
  }

  private indexType(expr: Extract<Expression, { kind: "IndexExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const array = parseArrayType(operand);
    if (!array) {
      this.error(`Cannot index non-array type '${operand}'`, expr.span);
      return "<error>";
    }
    const index = this.typeOf(expr.index, locals);
    if (!isIntegerType(index)) this.error(`Array index type '${index}' is not an integer`, expr.index.span);
    return array.element;
  }

  private postfixPointerType(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    if (expr.operator === ".&") return `${operand}&`;
    if (isPointerLikeType(operand)) return operand.slice(0, -1);
    this.error(`Cannot dereference non-pointer-like type '${operand}'`, expr.span);
    return "<error>";
  }

  private checkType(type: TypeRef): void {
    switch (type.kind) {
      case "NamedTypeRef":
        if (!primitiveTypes.has(type.name) && !this.typeAliases.has(type.name)) this.error(`Unknown type '${type.name}'`, type.span);
        return;
      case "PointerTypeRef":
      case "ReferenceTypeRef":
        this.checkType(type.element);
        return;
      case "FixedArrayTypeRef":
        this.checkType(type.element);
        this.checkArraySize(type.sizeText, type.span);
        return;
      case "InferredArrayTypeRef":
        this.checkType(type.element);
        return;
      case "RecordTypeRef":
        this.checkRecordType(type);
        return;
    }
  }

  private checkCAbiFunction(fn: FunctionDecl, label: Str): void {
    if (!this.isCAbiType(fn.returnType)) this.error(`${label} function '${fn.name}' return type '${typeName(fn.returnType)}' is not C ABI compatible`, fn.returnType.span);
    for (const param of fn.params) {
      if (!this.isCAbiType(param.type)) this.error(`${label} function '${fn.name}' parameter '${param.name}' type '${typeName(param.type)}' is not C ABI compatible`, param.span);
    }
  }

  private checkMainFunction(fn: FunctionDecl, returnType: TypeName): void {
    if (fn.external) this.error("Function 'main' cannot be extern", fn.span);
    if (fn.params.length !== 0) this.error("Function 'main' cannot have parameters", fn.span);
    if (returnType !== "i32") this.error(`Function 'main' must return 'i32'`, fn.returnType.span);
  }

  private isCAbiType(type: TypeRef, seen: Set<Str> = new Set<Str>()): b8 {
    switch (type.kind) {
      case "NamedTypeRef":
        return this.isCAbiNamedType(type.name, seen);
      case "PointerTypeRef":
        return this.isCAbiType(type.element, seen);
      case "RecordTypeRef":
        return type.fields.every((field) => this.isCAbiRecordFieldType(field.type, seen));
      case "ReferenceTypeRef":
      case "InferredArrayTypeRef":
      case "FixedArrayTypeRef":
        return false;
    }
  }

  private isCAbiNamedType(name: Str, seen: Set<Str>): b8 {
    const alias = this.typeAliases.get(name);
    if (!alias) return primitiveTypes.has(name);
    if (seen.has(name)) return false;
    seen.add(name);
    return this.isCAbiType(alias, seen);
  }

  private isCAbiRecordFieldType(type: TypeRef, seen: Set<Str>): b8 {
    if (type.kind === "FixedArrayTypeRef") return this.isCAbiRecordFieldType(type.element, seen);
    return this.isCAbiType(type, seen);
  }

  private checkRecordType(type: RecordTypeRef): void {
    const fields = new Set<Str>();
    for (const field of type.fields) {
      if (fields.has(field.name)) this.error(`Duplicate field '${field.name}'`, field.span);
      fields.add(field.name);
      this.checkType(field.type);
      this.checkValueType(field.type, `Field '${field.name}' cannot have type 'void'`, field.span);
      if (field.type.kind === "InferredArrayTypeRef") this.error(`Field '${field.name}' cannot have inferred array type`, field.span);
    }
  }

  private checkValueType(type: TypeRef, message: Str, span: SourceSpan): void {
    if (type.kind === "NamedTypeRef" && type.name === "void") this.error(message, span);
  }

  private checkParamType(param: FunctionDecl["params"][usize], functionName: Str): void {
    if (param.type.kind === "InferredArrayTypeRef") this.error(`Parameter '${param.name}' of function '${functionName}' cannot have inferred array type`, param.span);
  }

  private checkArraySize(sizeText: Str, span: SourceSpan): void {
    if (Number(sizeText) > 0) return;
    this.error(`Array size must be greater than zero`, span);
  }

  private error(message: Str, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
}

function collectTypeAliasRefs(type: TypeRef): Set<Str> {
  const refs = new Set<Str>();
  collectTypeAliasRefsInto(type, refs);
  return refs;
}

function collectTypeAliasRefsInto(type: TypeRef, refs: Set<Str>): void {
  switch (type.kind) {
    case "NamedTypeRef":
      if (!primitiveTypes.has(type.name)) refs.add(type.name);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeAliasRefsInto(type.element, refs);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeAliasRefsInto(field.type, refs);
      return;
  }
}

function blockReturns(statements: Statement[]): b8 {
  return statements.some(statementReturns);
}

function statementReturns(statement: Statement): b8 {
  if (statement.kind === "ReturnStmt") return true;
  if (statement.kind !== "IfStmt") return false;
  if (!statement.elseBody) return false;
  return blockReturns(statement.thenBody.statements) && blockReturns(statement.elseBody.statements);
}

function isComparisonOperator(operator: Str): b8 {
  return operator === "<" || operator === "<=" || operator === ">" || operator === ">=" || operator === "==" || operator === "!=";
}

function isAssignable(actual: TypeName, expected: TypeName): b8 {
  if (actual === expected) return true;
  const expectedArray = parseArrayType(expected);
  const actualArray = parseArrayType(actual);
  if (expectedArray && actualArray) return expectedArray.element === actualArray.element && (expectedArray.length === null || expectedArray.length === actualArray.length);
  if (!isReferenceType(actual)) return false;
  if (!isPointerLikeType(expected)) return false;
  return pointeeType(actual) === pointeeType(expected);
}

function parseArrayType(type: TypeName): { element: TypeName; length: i32 | null } | null {
  const match = type.match(/^(.+)\[(\d*)\]$/);
  if (!match) return null;
  return { element: match[1], length: match[2] ? Number(match[2]) as i32 : null };
}

function isIntegerType(type: TypeName): b8 {
  return type === "i8" || type === "i16" || type === "i32" || type === "i64" || type === "u8" || type === "u16" || type === "u32" || type === "u64" || type === "usize";
}

function isFloatType(type: TypeName): b8 {
  return type === "f32" || type === "f64";
}

function isPointerLikeType(type: TypeName): b8 {
  return type.endsWith("*") || type.endsWith("&");
}

function isReferenceType(type: TypeName): b8 {
  return type.endsWith("&");
}

function pointeeType(type: TypeName): TypeName {
  return type.slice(0, -1);
}

function spanKey(span: SourceSpan): Str {
  return `${span.start.offset}:${span.end.offset}`;
}
