import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeRef } from "./ast.ts";
import type { ResolvedProgram } from "./rast.ts";
import type { TypedProgram, TypeName } from "./tast.ts";
import { primitiveTypes } from "./token.ts";
import { typeName } from "./type_ref.ts";

type Str = string;
type i32 = number;
type b8 = boolean;

export type CheckedProgram = TypedProgram;

const numericTypes = new Set<Str>(["i8", "i16", "i32", "i64", "u8", "u16", "u32", "u64", "f32", "f64"]);

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
    for (const typeAlias of this.program.typeAliases) this.checkType(typeAlias.type);
    for (const fn of this.program.functions) {
      this.functions.set(fn.name, fn);
      this.checkType(fn.returnType);
      for (const param of fn.params) this.checkType(param.type);
    }
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = new Map<Str, TypeName>();
    for (const param of fn.params) locals.set(param.name, typeName(param.type));

    let hasReturn = false;
    const returnType = typeName(fn.returnType);
    for (const stmt of fn.body.statements) {
      if (stmt.kind === "ReturnStmt") hasReturn = true;
      this.checkStatement(stmt, locals, returnType);
    }
    if (returnType !== "void" && !hasReturn) this.error(`Function '${fn.name}' must return '${returnType}'`, fn.span);
  }

  private checkStatement(stmt: Statement, locals: Map<Str, TypeName>, returnType: TypeName): void {
    switch (stmt.kind) {
      case "ReturnStmt":
        this.checkReturn(stmt.expression, locals, returnType, stmt.span);
        return;
      case "VarDeclStmt":
        this.checkVarDecl(stmt, locals);
        return;
    }
  }

  private checkReturn(expr: Expression, locals: Map<Str, TypeName>, expected: TypeName, span: SourceSpan): void {
    const actual = this.typeOfExpected(expr, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Return type '${actual}' is not assignable to '${expected}'`, span);
  }

  private checkVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, locals: Map<Str, TypeName>): void {
    this.checkType(stmt.type);
    const expected = typeName(stmt.type);
    const actual = this.typeOfExpected(stmt.initializer, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Initializer type '${actual}' is not assignable to '${expected}'`, stmt.span);
    locals.set(stmt.name, actual);
  }

  private typeOf(expr: Expression, locals: Map<Str, TypeName>): TypeName {
    const type = this.computeType(expr, locals);
    this.expressionTypes.set(spanKey(expr.span), { type });
    return type;
  }

  private typeOfExpected(expr: Expression, locals: Map<Str, TypeName>, expected: TypeName): TypeName {
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

  private computeType(expr: Expression, locals: Map<Str, TypeName>): TypeName {
    switch (expr.kind) {
      case "IntegerLiteral":
        return "i32";
      case "FloatLiteral":
        return "f64";
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

  private identifierType(name: Str, locals: Map<Str, TypeName>, span: SourceSpan): TypeName {
    const type = locals.get(name);
    if (type) return type;
    this.error(`Unknown identifier '${name}'`, span);
    return "<error>";
  }

  private binaryType(expr: Extract<Expression, { kind: "BinaryExpr" }>, locals: Map<Str, TypeName>): TypeName {
    const left = this.typeOf(expr.left, locals);
    const right = this.typeOf(expr.right, locals);
    if (left !== right) {
      this.error(`Cannot apply '${expr.operator}' to '${left}' and '${right}'`, expr.span);
      return "<error>";
    }
    if (!numericTypes.has(left)) this.error(`Operator '${expr.operator}' requires numeric operands`, expr.span);
    return left;
  }

  private callType(expr: Extract<Expression, { kind: "CallExpr" }>, locals: Map<Str, TypeName>): TypeName {
    const fn = this.functions.get(expr.callee);
    if (!fn) {
      this.error(`Unknown function '${expr.callee}'`, expr.span);
      return "<error>";
    }

    this.checkCallArgs(expr.args, fn, locals, expr.span);
    return typeName(fn.returnType);
  }

  private checkCallArgs(args: Expression[], fn: FunctionDecl, locals: Map<Str, TypeName>, span: SourceSpan): void {
    if (args.length !== fn.params.length) this.error(`Function '${fn.name}' expects ${fn.params.length} arguments, got ${args.length}`, span);
    const count = Math.min(args.length, fn.params.length) as i32;
    for (let index = 0; index < count; index++) this.checkCallArg(args[index]!, fn, locals, index);
  }

  private checkCallArg(arg: Expression, fn: FunctionDecl, locals: Map<Str, TypeName>, index: i32): void {
    const expected = typeName(fn.params[index]!.type);
    const actual = this.typeOfExpected(arg, locals, expected);
    if (!isAssignable(actual, expected)) this.error(`Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`, arg.span);
  }

  private fieldAccessType(expr: Extract<Expression, { kind: "FieldAccessExpr" }>, locals: Map<Str, TypeName>): TypeName {
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

  private recordLiteralType(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, TypeName>, expected: TypeName): TypeName {
    const record = this.recordAlias(expected);
    if (!record) {
      this.error(`Record literal is not assignable to non-record type '${expected}'`, expr.span);
      return "<error>";
    }
    this.checkRecordLiteralFields(expr, locals, expected, record);
    return expected;
  }

  private checkRecordLiteralFields(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, TypeName>, expected: TypeName, record: RecordTypeRef): void {
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

  private arrayLiteralType(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, locals: Map<Str, TypeName>, expected: TypeName): TypeName {
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

  private indexType(expr: Extract<Expression, { kind: "IndexExpr" }>, locals: Map<Str, TypeName>): TypeName {
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

  private postfixPointerType(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, locals: Map<Str, TypeName>): TypeName {
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

  private checkRecordType(type: RecordTypeRef): void {
    const fields = new Set<Str>();
    for (const field of type.fields) {
      if (fields.has(field.name)) this.error(`Duplicate field '${field.name}'`, field.span);
      fields.add(field.name);
      this.checkType(field.type);
    }
  }

  private checkArraySize(sizeText: Str, span: SourceSpan): void {
    if (Number(sizeText) > 0) return;
    this.error(`Array size must be greater than zero`, span);
  }

  private error(message: Str, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
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
