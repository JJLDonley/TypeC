import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { ConstDecl, Expression, FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import { classMethodName } from "core/classes.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import type { ResolvedProgram } from "core/rast.ts";
import type { TypedProgram, TypeName } from "core/tast.ts";
import { checkArenaCall, checkExpectedArenaCall } from "checker/arenas.ts";
import { checkAssignment as collectAssignmentDiagnostics } from "checker/assignments.ts";
import { checkBinaryExpression } from "checker/binary_expressions.ts";
import { checkExpectedCallbackExpression } from "checker/callback_expressions.ts";
import { checkCallExpression } from "checker/call_expressions.ts";
import { checkConditionalExpression } from "checker/conditional_expressions.ts";
import { checkIfStatement, checkWhileStatement } from "checker/control_flow.ts";
import { checkConstantValue } from "checker/constants.ts";
import { spanKey } from "checker/exprs.ts";
import { isEnumTypeName } from "checker/enums.ts";
import { checkExpectedExpression } from "checker/expected_expressions.ts";
import { checkExpressionStatement as collectExpressionStatementDiagnostics } from "checker/expression_statements.ts";
import { computeExpressionType } from "checker/expression_types.ts";
import { checkFieldAccessExpression } from "checker/field_access_expressions.ts";
import { checkFunctionHeader as collectFunctionHeaderDiagnostics } from "checker/function_checks.ts";
import { checkIdentifierType } from "checker/identifiers.ts";
import { checkIndexExpression } from "checker/index_expressions.ts";
import { checkLocalDeclaration } from "checker/local_declarations.ts";
import { createFunctionLocals, type LocalInfo } from "checker/locals.ts";
import { checkNonNullAssertExpression } from "checker/non_null_assertions.ts";
import { checkNullishCoalesceExpression } from "checker/nullish_coalescing.ts";
import {
  checkOptionalFieldAccessExpression,
  checkOptionalIndexExpression,
  checkOptionalMethodCallExpression,
} from "checker/optional_chaining.ts";
import { checkPostfixPointerExpression } from "checker/pointer_expressions.ts";
import { collectProgramDeclarations } from "checker/program_declarations.ts";
import { checkReturnStatement as collectReturnStatementDiagnostics } from "checker/return_statements.ts";
import { checkUnaryExpression } from "checker/unary_expressions.ts";
import { checkMissingFunctionReturn as collectMissingFunctionReturnDiagnostics } from "checker/returns.ts";
import { checkStatementDispatch } from "checker/statements.ts";
import {
  checkTaggedUnionConstructor,
  checkTaggedUnionFieldAccess,
} from "checker/tagged_union_expressions.ts";
import { checkSwitchStatement } from "checker/switch_statements.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

export type CheckedProgram = TypedProgram;

export * from "checker/array_indexes.ts";
export * from "checker/array_initializers.ts";
export * from "checker/array_literal_expressions.ts";
export * from "checker/array_literals.ts";
export * from "checker/assignments.ts";
export * from "checker/basic_expressions.ts";
export * from "checker/binary_expressions.ts";
export * from "checker/binary_operations.ts";
export * from "checker/c_abi.ts";
export * from "checker/c_abi_diagnostics.ts";
export * from "checker/c_abi_shapes.ts";
export * from "checker/c_ordinary_symbols.ts";
export * from "checker/c_symbol_names.ts";
export * from "checker/c_symbols.ts";
export * from "checker/call_args.ts";
export * from "checker/callback_expressions.ts";
export * from "checker/call_expressions.ts";
export * from "checker/conditional_expressions.ts";
export * from "checker/calls.ts";
export * from "checker/conditions.ts";
export * from "checker/control_flow.ts";
export * from "checker/constant_division.ts";
export * from "checker/constant_ranges.ts";
export * from "checker/constant_values.ts";
export * from "checker/constants.ts";
export * from "checker/enums.ts";
export * from "checker/expected_expressions.ts";
export * from "checker/expression_statements.ts";
export * from "checker/expression_types.ts";
export * from "checker/exprs.ts";
export * from "checker/field_access.ts";
export * from "checker/field_access_expressions.ts";
export * from "checker/function_checks.ts";
export * from "checker/function_signatures.ts";
export * from "checker/identifiers.ts";
export * from "checker/index_expressions.ts";
export * from "checker/interfaces.ts";
export * from "checker/literal_ranges.ts";
export * from "checker/local_declarations.ts";
export * from "checker/local_types.ts";
export * from "checker/locals.ts";
export * from "checker/main.ts";
export * from "checker/non_null_assertions.ts";
export * from "checker/nullish_coalescing.ts";
export * from "checker/optional_chaining.ts";
export * from "checker/pointer_compatibility.ts";
export * from "checker/pointer_expressions.ts";
export * from "checker/pointer_ops.ts";
export * from "checker/program_declarations.ts";
export * from "checker/record_aliases.ts";
export * from "checker/record_literal_expressions.ts";
export * from "checker/record_literal_fields.ts";
export * from "checker/record_literals.ts";
export * from "checker/return_statements.ts";
export * from "checker/returns.ts";
export * from "checker/statements.ts";
export * from "checker/string_literals.ts";
export * from "checker/switch_statements.ts";
export * from "checker/type_alias_order.ts";
export * from "checker/type_name_shapes.ts";
export * from "checker/type_refs.ts";
export * from "checker/type_shapes.ts";
export * from "checker/type_validation.ts";
export * from "checker/unary_expressions.ts";
export * from "checker/types.ts";
export * from "checker/value_types.ts";
export * from "checker/variadic_args.ts";

export function check(program: ResolvedProgram): CheckedProgram {
  const checker = new Checker(program);
  return checker.check();
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private functions = new Map<Str, FunctionDecl>();
  private constants = new Map<Str, ConstDecl>();
  private typeAliases = new Map<Str, TypeRef>();
  private expressionTypes = new Map<Str, { type: TypeName }>();

  constructor(private program: ResolvedProgram) {}

  check(): CheckedProgram {
    this.collectFunctions();
    this.checkConstants();
    for (const fn of this.program.functions) this.checkFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { ...this.program, expressionTypes: this.expressionTypes };
  }

  private collectFunctions(): void {
    const declarations = collectProgramDeclarations(this.program);
    this.functions = declarations.functions;
    this.constants = declarations.constants;
    this.typeAliases = declarations.typeAliases;
    this.diagnostics.push(...declarations.diagnostics);
  }

  private checkConstants(): void {
    const moduleConstantNames = new Set<Str>(
      (this.program.constants ?? []).map((constant) => constant.name),
    );
    const available = new Map<Str, ConstDecl>(
      [...this.constants].filter(([name]) => !moduleConstantNames.has(name)),
    );
    for (const constant of this.program.constants ?? []) {
      this.checkConstant(constant, available);
      available.set(constant.name, constant);
    }
  }

  private checkConstant(constant: ConstDecl, availableConstants: Map<Str, ConstDecl>): void {
    this.diagnostics.push(
      ...checkConstantValue(
        constant,
        availableConstants,
        this.typeAliases,
        (expr, expected) => this.typeOfExpected(expr, new Map<Str, LocalInfo>(), expected),
      ),
    );
  }

  private checkFunction(fn: FunctionDecl): void {
    const locals = createFunctionLocals(fn);
    const returnType = typeName(fn.returnType);
    this.diagnostics.push(...collectFunctionHeaderDiagnostics(fn, returnType, this.typeAliases));
    if (!fn.body) return;
    for (const stmt of fn.body.statements) this.checkStatement(stmt, locals, returnType, false);
    this.diagnostics.push(...collectMissingFunctionReturnDiagnostics(fn, returnType));
  }

  private checkStatement(
    stmt: Statement,
    locals: Map<Str, LocalInfo>,
    returnType: TypeName,
    inSwitch: b8,
  ): void {
    checkStatementDispatch(stmt, {
      returnStatement: (expr, span) => this.checkReturn(expr, locals, returnType, span),
      deferStatement: (expr, span) => this.checkDefer(expr, locals, span),
      expressionStatement: (expr) => this.checkExpressionStatement(expr, locals),
      breakStatement: (span) => this.checkBreak(span, inSwitch),
      variableDeclaration: (value) => this.checkVarDecl(value, locals),
      assignment: (value) => this.checkAssignment(value, locals),
      switchStatement: (value) => this.checkSwitch(value, locals, returnType),
      whileStatement: (value) => this.checkWhile(value, locals, returnType),
      ifStatement: (value) => this.checkIf(value, locals, returnType, inSwitch),
    });
  }

  private checkDefer(expr: Expression, locals: Map<Str, LocalInfo>, span: SourceSpan): void {
    if (expr.kind !== "CallExpr" && expr.kind !== "MethodCallExpr") {
      this.diagnostics.push({ message: "Defer statement requires a call expression", span });
      return;
    }
    this.typeOf(expr, locals);
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

  private checkBreak(span: SourceSpan, inSwitch: b8): void {
    if (inSwitch) return;
    this.diagnostics.push({ message: "Break statement is only valid inside a switch", span });
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

  private checkSwitch(
    stmt: Extract<Statement, { kind: "SwitchStmt" }>,
    locals: Map<Str, LocalInfo>,
    returnType: TypeName,
  ): void {
    this.diagnostics.push(
      ...checkSwitchStatement(
        stmt,
        this.constants,
        (expr) => this.typeOf(expr, locals),
        (expr, expected) => this.typeOfExpected(expr, locals, expected),
        (children) => this.checkBlock(children, locals, returnType, true),
        (type) => isEnumTypeName(type, this.program.enums ?? []),
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
        (children, parent) => this.checkBlock(children, parent, returnType, false),
      ),
    );
  }

  private checkIf(
    stmt: Extract<Statement, { kind: "IfStmt" }>,
    locals: Map<Str, LocalInfo>,
    returnType: TypeName,
    inSwitch: b8,
  ): void {
    this.diagnostics.push(
      ...checkIfStatement(
        stmt,
        locals,
        (expr) => this.typeOf(expr, locals),
        (children, parent) => this.checkBlock(children, parent, returnType, inSwitch),
      ),
    );
  }

  private checkBlock(
    statements: Statement[],
    parentLocals: Map<Str, LocalInfo>,
    returnType: TypeName,
    inSwitch: b8,
  ): Diagnostic[] {
    const before = this.diagnostics.length;
    const locals = new Map<Str, LocalInfo>(parentLocals);
    for (const child of statements) this.checkStatement(child, locals, returnType, inSwitch);
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
    const arena = checkExpectedArenaCall(
      expr,
      expected,
      (value) => this.typeOf(value, locals),
      (value, target) => this.typeOfExpected(value, locals, target),
    );
    if (arena.handled) {
      this.diagnostics.push(...arena.diagnostics);
      this.expressionTypes.set(spanKey(expr.span), { type: arena.type });
      return arena.type;
    }
    const callback = this.globalCallbackType(expr, locals, expected);
    if (callback?.handled) {
      this.diagnostics.push(...callback.diagnostics);
      this.expressionTypes.set(spanKey(expr.span), { type: callback.type });
      return callback.type;
    }
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

  private globalCallbackType(
    expr: Expression,
    locals: Map<Str, LocalInfo>,
    expected: TypeName,
  ): ReturnType<typeof checkExpectedCallbackExpression> | null {
    if (expr.kind === "IdentifierExpr" && locals.has(expr.name)) return null;
    return checkExpectedCallbackExpression(expr, expected, this.functions);
  }

  private computeType(expr: Expression, locals: Map<Str, LocalInfo>): TypeName {
    const result = computeExpressionType(expr, {
      identifier: (name, span) => this.identifierType(name, locals, span),
      unary: (value) => this.unaryType(value, locals),
      binary: (value) => this.binaryType(value, locals),
      conditional: (value) => this.conditionalType(value, locals),
      nullish: (value) => this.nullishType(value, locals),
      call: (value) => this.callType(value, locals),
      methodCall: (value) => this.methodCallType(value, locals),
      pointer: (value) => this.postfixPointerType(value, locals),
      nonNullAssert: (value) => this.nonNullAssertType(value, locals),
      fieldAccess: (value) => this.fieldAccessType(value, locals),
      optionalFieldAccess: (value) => this.optionalFieldAccessType(value, locals),
      optionalMethodCall: (value) => this.optionalMethodCallType(value, locals),
      optionalIndex: (value) => this.optionalIndexType(value, locals),
      index: (value) => this.indexType(value, locals),
    });
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private identifierType(name: Str, locals: Map<Str, LocalInfo>, span: SourceSpan): TypeName {
    const result = checkIdentifierType(name, locals.get(name), this.constants.get(name), span);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private unaryType(
    expr: Extract<Expression, { kind: "UnaryExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkUnaryExpression(expr, (value) => this.typeOf(value, locals));
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
      (type) => isEnumTypeName(type, this.program.enums ?? []),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private conditionalType(
    expr: Extract<Expression, { kind: "ConditionalExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkConditionalExpression(
      expr,
      (value) => this.typeOf(value, locals),
      (value, expected) => this.typeOfExpected(value, locals, expected),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private nullishType(
    expr: Extract<Expression, { kind: "NullishCoalesceExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkNullishCoalesceExpression(
      expr,
      (operand) => this.typeOf(operand, locals),
      (fallback, expected) => this.typeOfExpected(fallback, locals, expected),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private callType(
    expr: Extract<Expression, { kind: "CallExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const arena = checkArenaCall(
      expr,
      (arg) => this.typeOf(arg, locals),
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
    );
    if (arena.handled) {
      this.diagnostics.push(...arena.diagnostics);
      return arena.type;
    }
    const result = checkCallExpression(
      expr,
      this.functions.get(expr.callee),
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
      (arg) => this.typeOf(arg, locals),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private methodCallType(
    expr: Extract<Expression, { kind: "MethodCallExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const unionConstructor = checkTaggedUnionConstructor(
      expr,
      this.program.taggedUnions ?? [],
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
    );
    if (unionConstructor.handled) {
      this.diagnostics.push(...unionConstructor.diagnostics);
      return unionConstructor.type;
    }
    const namespaceCall = this.namespaceCallType(expr, locals);
    if (namespaceCall !== null) return namespaceCall;
    const receiverType = this.typeOf(expr.receiver, locals);
    const methodName = classMethodName(receiverType, expr.method);
    const result = checkCallExpression(
      {
        kind: "CallExpr",
        callee: methodName,
        args: [expr.receiver, ...expr.args],
        span: expr.span,
      },
      this.functions.get(methodName),
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
      (arg) => this.typeOf(arg, locals),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private namespaceCallType(
    expr: Extract<Expression, { kind: "MethodCallExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName | null {
    if (expr.receiver.kind !== "IdentifierExpr") return null;
    const callee = `${expr.receiver.name}.${expr.method}`;
    const fn = this.functions.get(callee);
    if (!fn) return null;
    const result = checkCallExpression(
      { kind: "CallExpr", callee, args: expr.args, span: expr.span },
      fn,
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
      (arg) => this.typeOf(arg, locals),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private fieldAccessType(
    expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const constant = this.qualifiedConstant(expr);
    if (constant) return typeName(constant.type);
    const operand = this.typeOf(expr.operand, locals);
    const unionAccess = checkTaggedUnionFieldAccess(expr, operand, this.program.taggedUnions ?? []);
    if (unionAccess.handled) {
      this.diagnostics.push(...unionAccess.diagnostics);
      return unionAccess.type;
    }
    const result = checkFieldAccessExpression(expr, operand, this.typeAliases);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private qualifiedConstant(
    expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  ): ConstDecl | null {
    const name = qualifiedExpressionName(expr);
    return name === null ? null : this.constants.get(name) ?? null;
  }

  private optionalFieldAccessType(
    expr: Extract<Expression, { kind: "OptionalFieldAccessExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkOptionalFieldAccessExpression(expr, operand, this.typeAliases);
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private optionalMethodCallType(
    expr: Extract<Expression, { kind: "OptionalMethodCallExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.receiver, locals);
    const element = optionalTypeNameElement(operand) ?? "<error>";
    const fn = this.functions.get(classMethodName(element, expr.method));
    const result = checkOptionalMethodCallExpression(
      expr,
      operand,
      fn,
      (arg, expected) => this.typeOfExpected(arg, locals, expected),
      (arg) => this.typeOf(arg, locals),
    );
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }

  private optionalIndexType(
    expr: Extract<Expression, { kind: "OptionalIndexExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const operand = this.typeOf(expr.operand, locals);
    const result = checkOptionalIndexExpression(
      expr,
      operand,
      (index) => this.typeOf(index, locals),
    );
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

  private nonNullAssertType(
    expr: Extract<Expression, { kind: "NonNullAssertExpr" }>,
    locals: Map<Str, LocalInfo>,
  ): TypeName {
    const result = checkNonNullAssertExpression(expr, (operand) => this.typeOf(operand, locals));
    this.diagnostics.push(...result.diagnostics);
    return result.type;
  }
}
