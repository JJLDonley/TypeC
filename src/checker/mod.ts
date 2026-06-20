import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Expression, FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import type { TypedProgram, TypeName } from "core/tast.ts";
import { checkAssignment as collectAssignmentDiagnostics } from "checker/assignments.ts";
import { checkBinaryExpression } from "checker/binary_expressions.ts";
import { checkCallExpression } from "checker/call_expressions.ts";
import {
  checkCFunctionSymbols as collectCFunctionSymbolDiagnostics,
  checkCTypeAliasSymbols as collectCTypeAliasSymbolDiagnostics,
} from "checker/c_symbols.ts";
import { checkIfStatement, checkWhileStatement } from "checker/control_flow.ts";
import { checkDeclarations as collectDeclarationDiagnostics } from "checker/declarations.ts";
import { spanKey } from "checker/exprs.ts";
import { checkExpectedExpression } from "checker/expected_expressions.ts";
import { checkExpressionStatement as collectExpressionStatementDiagnostics } from "checker/expression_statements.ts";
import { computeExpressionType } from "checker/expression_types.ts";
import { checkFieldAccessExpression } from "checker/field_access_expressions.ts";
import { checkFunctionHeader as collectFunctionHeaderDiagnostics } from "checker/function_checks.ts";
import { checkIdentifierType } from "checker/identifiers.ts";
import { checkIndexExpression } from "checker/index_expressions.ts";
import { checkLocalDeclaration } from "checker/local_declarations.ts";
import { createFunctionLocals, type LocalInfo } from "checker/locals.ts";
import { checkPostfixPointerExpression } from "checker/pointer_expressions.ts";
import { checkReturnStatement as collectReturnStatementDiagnostics } from "checker/return_statements.ts";
import { checkMissingFunctionReturn as collectMissingFunctionReturnDiagnostics } from "checker/returns.ts";
import { checkStatementDispatch } from "checker/statements.ts";
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
    this.diagnostics.push(
      ...collectCFunctionSymbolDiagnostics(this.program.functions, this.program.typeAliases),
    );
    this.diagnostics.push(...collectCTypeAliasSymbolDiagnostics(this.program.typeAliases));
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = createFunctionLocals(fn);
    const returnType = typeName(fn.returnType);
    this.diagnostics.push(...collectFunctionHeaderDiagnostics(fn, returnType, this.typeAliases));
    if (!fn.body) return;
    for (const stmt of fn.body.statements) this.checkStatement(stmt, locals, returnType);
    this.diagnostics.push(...collectMissingFunctionReturnDiagnostics(fn, returnType));
  }

  private checkStatement(stmt: Statement, locals: Map<Str, LocalInfo>, returnType: TypeName): void {
    checkStatementDispatch(stmt, {
      returnStatement: (expr, span) => this.checkReturn(expr, locals, returnType, span),
      expressionStatement: (expr) => this.checkExpressionStatement(expr, locals),
      variableDeclaration: (value) => this.checkVarDecl(value, locals),
      assignment: (value) => this.checkAssignment(value, locals),
      whileStatement: (value) => this.checkWhile(value, locals, returnType),
      ifStatement: (value) => this.checkIf(value, locals, returnType),
    });
  }

  private checkExpressionStatement(expr: Expression, locals: Map<Str, LocalInfo>): void {
    this.diagnostics.push(...collectExpressionStatementDiagnostics(expr));
    this.typeOf(expr, locals);
  }

  private checkReturn(
    expr: Expression | null,
    locals: Map<Str, LocalInfo>,
    expected: TypeName,
    span: SourceSpan,
  ): void {
    this.diagnostics.push(
      ...collectReturnStatementDiagnostics(
        expr,
        expected,
        span,
        (value, target) => this.typeOfExpected(value, locals, target),
      ),
    );
  }

  private checkVarDecl(
    stmt: Extract<Statement, { kind: "VarDeclStmt" }>,
    locals: Map<Str, LocalInfo>,
  ): void {
    const result = checkLocalDeclaration(
      stmt,
      this.typeAliases,
      (expr, expected) => this.typeOfExpected(expr, locals, expected),
    );
    this.diagnostics.push(...result.diagnostics);
    locals.set(stmt.name, { type: result.type, mutable: stmt.mutable });
  }

  private checkAssignment(
    stmt: Extract<Statement, { kind: "AssignmentStmt" }>,
    locals: Map<Str, LocalInfo>,
  ): void {
    this.diagnostics.push(
      ...collectAssignmentDiagnostics(
        stmt,
        locals.get(stmt.name),
        (expr, expected) => this.typeOfExpected(expr, locals, expected),
      ),
    );
  }

  private checkWhile(
    stmt: Extract<Statement, { kind: "WhileStmt" }>,
    locals: Map<Str, LocalInfo>,
    returnType: TypeName,
  ): void {
    this.diagnostics.push(
      ...checkWhileStatement(
        stmt,
        locals,
        (expr) => this.typeOf(expr, locals),
        (children, parent) => this.checkBlock(children, parent, returnType),
      ),
    );
  }

  private checkIf(
    stmt: Extract<Statement, { kind: "IfStmt" }>,
    locals: Map<Str, LocalInfo>,
    returnType: TypeName,
  ): void {
    this.diagnostics.push(
      ...checkIfStatement(
        stmt,
        locals,
        (expr) => this.typeOf(expr, locals),
        (children, parent) => this.checkBlock(children, parent, returnType),
      ),
    );
  }

  private checkBlock(
    statements: Statement[],
    parentLocals: Map<Str, LocalInfo>,
    returnType: TypeName,
  ): Diagnostic[] {
    const before = this.diagnostics.length;
    const locals = new Map<Str, LocalInfo>(parentLocals);
    for (const child of statements) this.checkStatement(child, locals, returnType);
    return this.diagnostics.splice(before);
  }

  private typeOf(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    const type = this.computeType(expr, locals);
    this.expressionTypes.set(spanKey(expr.span), { type });
    return type;
  }

  private typeOfExpected(
    expr: Expression,
    locals: Map<Str, LocalInfo>,
    expected: TypeName,
  ): TypeName {
    const result = checkExpectedExpression(
      expr,
      expected,
      this.typeAliases,
      (value, target) => this.typeOfExpected(value, locals, target),
    );
    if (!result.handled) return this.typeOf(expr, locals);
    this.diagnostics.push(...result.diagnostics);
    this.expressionTypes.set(spanKey(expr.span), { type: result.type });
    return result.type;
  }

  private computeType(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    const result = computeExpressionType(expr, {
      identifier: (name, span) => this.identifierType(name, locals, span),
      binary: (value) => this.binaryType(value, locals),
      call: (value) => this.callType(value, locals),
      pointer: (value) => this.postfixPointerType(value, locals),
      fieldAccess: (value) => this.fieldAccessType(value, locals),
      index: (value) => this.indexType(value, locals),
    });
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private identifierType(name: Str, locals: Map<Str, LocalInfo>, span: SourceSpan): TypeName {
    const result = checkIdentifierType(name, locals.get(name), span);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private binaryType(
    expr: Extract<Expression, { kind: "BinaryExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkBinaryExpression(
      expr,
      (value) => this.typeOf(value, locals),
      (value, expected) => this.typeOfExpected(value, locals, expected),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private callType(
    expr: Extract<Expression, { kind: "CallExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkCallExpression(
      expr,
      this.functions.get(expr.callee),
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private fieldAccessType(
    expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkFieldAccessExpression(expr, operand, this.typeAliases);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private indexType(
    expr: Extract<Expression, { kind: "IndexExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkIndexExpression(expr, operand, (index) => this.typeOf(index, locals));
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private postfixPointerType(
    expr: Extract<Expression, { kind: "PostfixPointerExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkPostfixPointerExpression(expr, operand);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }
}
