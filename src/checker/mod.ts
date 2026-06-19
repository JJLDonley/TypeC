import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import type { TypedProgram, TypeName } from "core/tast.ts";
import { checkArrayIndex as collectArrayIndexDiagnostics } from "checker/array_indexes.ts";
import { checkArrayInitializer as collectArrayInitializerDiagnostics } from "checker/array_initializers.ts";
import {
  checkArrayLiteralElementType as collectArrayLiteralElementTypeDiagnostics,
  checkArrayLiteralLength as collectArrayLiteralLengthDiagnostics,
  checkArrayLiteralTarget as collectArrayLiteralTargetDiagnostics,
  checkInferredArrayLiteral as collectInferredArrayLiteralDiagnostics,
} from "checker/array_literals.ts";
import { checkAssignment as collectAssignmentDiagnostics } from "checker/assignments.ts";
import { checkBinaryOperation } from "checker/binary_operations.ts";
import { checkCAbiFunction as collectCAbiFunctionDiagnostics } from "checker/c_abi_diagnostics.ts";
import { checkCallArguments as collectCallArgumentDiagnostics } from "checker/calls.ts";
import {
  checkIfCondition as collectIfConditionDiagnostics,
  checkWhileCondition as collectWhileConditionDiagnostics,
} from "checker/conditions.ts";
import { checkDeclarations as collectDeclarationDiagnostics } from "checker/declarations.ts";
import { spanKey } from "checker/exprs.ts";
import { checkExpressionStatement as collectExpressionStatementDiagnostics } from "checker/expression_statements.ts";
import { checkFieldAccess } from "checker/field_access.ts";
import { checkFunctionReturnType as collectFunctionReturnTypeDiagnostics } from "checker/function_signatures.ts";
import {
  checkFloatLiteralRange as collectFloatLiteralRangeDiagnostics,
  checkIntegerLiteralRange as collectIntegerLiteralRangeDiagnostics,
} from "checker/literal_ranges.ts";
import { checkLocalDeclaration } from "checker/local_declarations.ts";
import { createFunctionLocals, type LocalInfo } from "checker/locals.ts";
import { checkMainFunction as collectMainFunctionDiagnostics } from "checker/main.ts";
import { checkPostfixPointerOperation } from "checker/pointer_ops.ts";
import {
  checkRecordLiteralFieldName as collectRecordLiteralFieldNameDiagnostics,
  checkRecordLiteralMissingFields as collectRecordLiteralMissingFieldDiagnostics,
  checkRecordLiteralTarget as collectRecordLiteralTargetDiagnostics,
  findRecordField,
} from "checker/record_literals.ts";
import { blockReturns } from "checker/returns.ts";
import { checkStringLiteralTarget as collectStringLiteralTargetDiagnostics, stringLiteralType } from "checker/string_literals.ts";
import { isAssignable, isFloatType, isIntegerType, parseArrayType } from "checker/types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

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
    const declarations = collectDeclarationDiagnostics(this.program);
    this.functions = declarations.functions;
    this.typeAliases = declarations.typeAliases;
    this.diagnostics.push(...declarations.diagnostics);
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
      case "ExpressionStmt":
        this.diagnostics.push(...collectExpressionStatementDiagnostics(stmt.expression));
        this.typeOf(stmt.expression, locals);
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
    const result = checkLocalDeclaration(stmt, this.typeAliases, (expr, expected) => this.typeOfExpected(expr, locals, expected));
    this.diagnostics.push(...result.diagnostics);
    locals.set(stmt.name, { type: result.type, mutable: stmt.mutable });
  }

  private checkAssignment(stmt: Extract<Statement, { kind: "AssignmentStmt" }>, locals: Map<Str, LocalInfo>): void {
    this.diagnostics.push(...collectAssignmentDiagnostics(stmt, locals.get(stmt.name), (expr, expected) => this.typeOfExpected(expr, locals, expected)));
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
    if (expr.kind === "StringLiteral") {
      const type = stringLiteralType(expr);
      this.diagnostics.push(...collectStringLiteralTargetDiagnostics(type, expected, expr));
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
      case "StringLiteral":
        this.error("String literals require an expected C string type", expr.span);
        return stringLiteralType(expr);
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

    this.diagnostics.push(...collectCallArgumentDiagnostics(expr.args, fn, (arg, expected) => this.typeOfExpected(arg, locals, expected), expr.span));
    return typeName(fn.returnType);
  }

  private fieldAccessType(expr: Extract<Expression, { kind: "FieldAccessExpr" }>, locals: Map<Str, LocalInfo>): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkFieldAccess(this.recordAlias(operand), operand, expr.field, expr.span);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private recordLiteralType(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    const record = this.recordAlias(expected);
    this.diagnostics.push(...collectRecordLiteralTargetDiagnostics(record, expected, expr));
    if (!record) return "<error>";
    this.checkRecordLiteralFields(expr, locals, expected, record);
    return expected;
  }

  private checkRecordLiteralFields(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName, record: RecordTypeRef): void {
    const seen = new Set<Str>();
    for (const field of expr.fields) {
      this.diagnostics.push(...collectRecordLiteralFieldNameDiagnostics(field, record, expected, seen));
      const expectedField = findRecordField(record, field.name);
      if (!expectedField) continue;
      const expectedType = typeName(expectedField.type);
      this.diagnostics.push(...collectArrayInitializerDiagnostics(field.expression, expectedType, field.span));
      const actual = this.typeOfExpected(field.expression, locals, expectedType);
      if (!isAssignable(actual, expectedType)) this.error(`Field '${field.name}' type '${actual}' is not assignable to '${expectedType}'`, field.span);
    }
    this.diagnostics.push(...collectRecordLiteralMissingFieldDiagnostics(expr, record, expected, seen));
  }

  private recordAlias(name: TypeName): RecordTypeRef | null {
    const type = this.typeAliases.get(name);
    if (type?.kind === "RecordTypeRef") return type;
    return null;
  }

  private arrayLiteralType(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, locals: Map<Str, LocalInfo>, expected: TypeName): TypeName {
    const target = collectArrayLiteralTargetDiagnostics(expected, expr);
    this.diagnostics.push(...target.diagnostics);
    if (!target.array) return "<error>";
    this.diagnostics.push(...collectInferredArrayLiteralDiagnostics(expr, target.array));
    for (const element of expr.elements) {
      const actual = this.typeOfExpected(element, locals, target.array.element);
      this.diagnostics.push(...collectArrayLiteralElementTypeDiagnostics(actual, target.array.element, element));
    }
    this.diagnostics.push(...collectArrayLiteralLengthDiagnostics(expr.elements.length, target.array, expected, expr));
    return `${target.array.element}[${expr.elements.length}]`;
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

  private checkCAbiFunction(fn: FunctionDecl, label: Str): void {
    this.diagnostics.push(...collectCAbiFunctionDiagnostics(fn, label, this.typeAliases));
  }

  private checkMainFunction(fn: FunctionDecl, returnType: TypeName): void {
    this.diagnostics.push(...collectMainFunctionDiagnostics(fn, returnType));
  }


  private error(message: Str, span: Diagnostic["span"]): void {
    this.diagnostics.push({ message, span });
  }
}

