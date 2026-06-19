import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeRef } from "./ast.ts";
import type { ResolvedProgram } from "./rast.ts";
import type { TypedProgram, TypeName } from "./tast.ts";
import { checkArrayIndex as collectArrayIndexDiagnostics } from "./checker_array_indexes.ts";
import { checkArrayInitializer as collectArrayInitializerDiagnostics } from "./checker_array_initializers.ts";
import { checkBinaryOperation } from "./checker_binary_operations.ts";
import { checkCAbiFunction as collectCAbiFunctionDiagnostics } from "./checker_c_abi_diagnostics.ts";
import {
  checkCallArgumentType as collectCallArgumentTypeDiagnostics,
  checkCallArity as collectCallArityDiagnostics,
} from "./checker_call_args.ts";
import {
  checkIfCondition as collectIfConditionDiagnostics,
  checkWhileCondition as collectWhileConditionDiagnostics,
} from "./checker_conditions.ts";
import { spanKey } from "./checker_exprs.ts";
import {
  checkFunctionParamType as collectFunctionParamTypeDiagnostics,
  checkFunctionReturnType as collectFunctionReturnTypeDiagnostics,
} from "./checker_function_signatures.ts";
import {
  checkFloatLiteralRange as collectFloatLiteralRangeDiagnostics,
  checkIntegerLiteralRange as collectIntegerLiteralRangeDiagnostics,
} from "./checker_literal_ranges.ts";
import { createFunctionLocals, type LocalInfo } from "./checker_locals.ts";
import { checkMainFunction as collectMainFunctionDiagnostics } from "./checker_main.ts";
import { checkPostfixPointerOperation } from "./checker_pointer_ops.ts";
import { blockReturns } from "./checker_returns.ts";
import { checkValueType as collectValueTypeDiagnostics } from "./checker_value_types.ts";
import { isAssignable, isFloatType, isIntegerType, parseArrayType } from "./checker_types.ts";
import { checkTypeAliasOrder as collectTypeAliasOrderDiagnostics } from "./checker_type_alias_order.ts";
import {
  checkArrayElementType as collectArrayElementTypeDiagnostics,
  checkArraySize as collectArraySizeDiagnostics,
  checkPointerElementType as collectPointerElementTypeDiagnostics,
  checkReferenceElementType as collectReferenceElementTypeDiagnostics,
} from "./checker_type_shapes.ts";
import { primitiveTypes } from "./token.ts";
import { typeName } from "./type_ref.ts";

type Str = string;
type usize = number;

export type CheckedProgram = TypedProgram;

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
        this.diagnostics.push(...collectValueTypeDiagnostics(param.type, `Parameter '${param.name}' cannot have type 'void'`, param.span));
        this.diagnostics.push(...collectFunctionParamTypeDiagnostics(param, fn.name));
      }
    }
  }

  private checkTypeAliasOrder(): void {
    this.diagnostics.push(...collectTypeAliasOrderDiagnostics(this.program.typeAliases));
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = createFunctionLocals(fn);
    const returnType = typeName(fn.returnType);
    this.diagnostics.push(...collectFunctionReturnTypeDiagnostics(fn, returnType));
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
    this.diagnostics.push(...collectValueTypeDiagnostics(stmt.type, `Variable '${stmt.name}' cannot have type 'void'`, stmt.span));
    const expected = typeName(stmt.type);
    this.diagnostics.push(...collectArrayInitializerDiagnostics(stmt.initializer, expected, stmt.span));
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
    this.diagnostics.push(...collectWhileConditionDiagnostics(condition, stmt.condition.span));
    this.checkBlock(stmt.body.statements, locals, returnType);
  }

  private checkIf(stmt: Extract<Statement, { kind: "IfStmt" }>, locals: Map<Str, LocalInfo>, returnType: TypeName): void {
    const condition = this.typeOf(stmt.condition, locals);
    this.diagnostics.push(...collectIfConditionDiagnostics(condition, stmt.condition.span));
    this.checkBlock(stmt.thenBody.statements, locals, returnType);
    if (stmt.elseBody) this.checkBlock(stmt.elseBody.statements, locals, returnType);
  }

  private checkBlock(statements: Statement[], parentLocals: Map<Str, LocalInfo>, returnType: TypeName): void {
    const locals = new Map<Str, LocalInfo>(parentLocals);
    for (const child of statements) this.checkStatement(child, locals, returnType);
  }

  private typeOf(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    const type = this.computeType(expr, locals);
    this.expressionTypes.set(spanKey(expr.span), { type });
    return type;
  }

  private typeOfExpected(expr: Expression, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    if (expr.kind === "IntegerLiteral" && isIntegerType(expected)) {
      this.diagnostics.push(...collectIntegerLiteralRangeDiagnostics(expr, expected));
      this.expressionTypes.set(spanKey(expr.span), { type: expected });
      return expected;
    }
    if (expr.kind === "FloatLiteral" && isFloatType(expected)) {
      this.diagnostics.push(...collectFloatLiteralRangeDiagnostics(expr, expected));
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
        this.diagnostics.push(...collectIntegerLiteralRangeDiagnostics(expr, "i32"));
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
    const result = checkBinaryOperation(expr, hinted);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
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
    this.diagnostics.push(...collectCallArityDiagnostics(args.length, fn.params.length, fn.name, span));
    for (let index: usize = 0; index < args.length && index < fn.params.length; index++) {
      const expected = typeName(fn.params[index]!.type);
      const actual = this.typeOfExpected(args[index]!, locals, expected);
      this.diagnostics.push(...collectCallArgumentTypeDiagnostics(actual, expected, index, args[index]!.span));
    }
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
      const expectedType = typeName(expectedField.type);
      this.diagnostics.push(...collectArrayInitializerDiagnostics(field.expression, expectedType, field.span));
      const actual = this.typeOfExpected(field.expression, locals, expectedType);
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
    if (array.length === null && expr.elements.length === 0) this.error("Cannot infer empty array type", expr.span);
    for (const element of expr.elements) {
      const actual = this.typeOfExpected(element, locals, array.element);
      if (!isAssignable(actual, array.element)) this.error(`Array element type '${actual}' is not assignable to '${array.element}'`, element.span);
    }
    if (array.length !== null && array.length !== BigInt(expr.elements.length)) this.error(`Array length ${expr.elements.length} is not assignable to '${expected}'`, expr.span);
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
    this.diagnostics.push(...collectArrayIndexDiagnostics(expr.index, index, array.length));
    return array.element;
  }

  private postfixPointerType(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkPostfixPointerOperation(expr, operand);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private checkType(type: TypeRef): void {
    switch (type.kind) {
      case "NamedTypeRef":
        if (!primitiveTypes.has(type.name) && !this.typeAliases.has(type.name)) this.error(`Unknown type '${type.name}'`, type.span);
        return;
      case "PointerTypeRef":
        this.checkType(type.element);
        this.diagnostics.push(...collectPointerElementTypeDiagnostics(type));
        return;
      case "ReferenceTypeRef":
        this.checkType(type.element);
        this.diagnostics.push(...collectReferenceElementTypeDiagnostics(type));
        return;
      case "FixedArrayTypeRef":
        this.checkType(type.element);
        this.diagnostics.push(...collectArrayElementTypeDiagnostics(type));
        this.diagnostics.push(...collectArraySizeDiagnostics(type.sizeText, type));
        return;
      case "InferredArrayTypeRef":
        this.checkType(type.element);
        this.diagnostics.push(...collectArrayElementTypeDiagnostics(type));
        return;
      case "RecordTypeRef":
        this.checkRecordType(type);
        return;
    }
  }

  private checkCAbiFunction(fn: FunctionDecl, label: Str): void {
    this.diagnostics.push(...collectCAbiFunctionDiagnostics(fn, label, this.typeAliases));
  }

  private checkMainFunction(fn: FunctionDecl, returnType: TypeName): void {
    this.diagnostics.push(...collectMainFunctionDiagnostics(fn, returnType));
  }

  private checkRecordType(type: RecordTypeRef): void {
    const fields = new Set<Str>();
    for (const field of type.fields) {
      if (fields.has(field.name)) this.error(`Duplicate field '${field.name}'`, field.span);
      fields.add(field.name);
      this.checkType(field.type);
      this.diagnostics.push(...collectValueTypeDiagnostics(field.type, `Field '${field.name}' cannot have type 'void'`, field.span));
      if (field.type.kind === "InferredArrayTypeRef") this.error(`Field '${field.name}' cannot have inferred array type`, field.span);
    }
  }

  private error(message: Str, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
}

