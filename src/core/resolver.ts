import { DUPLICATE_FUNCTION, DUPLICATE_SYMBOL, UNKNOWN_IDENTIFIER } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { taggedUnionTagConstants } from "core/tagged_union_constants.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Expression, FunctionDecl, Program, Statement } from "core/ast.ts";
import { enumMemberSymbolName } from "core/enums.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import type { ResolvedProgram, SymbolKind } from "core/rast.ts";
import { type Scope, ScopeTable } from "core/scope.ts";

type Str = string;
type b8 = boolean;

const builtinFunctions = new Set<Str>([
  "arenaCreate",
  "arenaDestroy",
  "arenaAlloc",
  "Some",
  "None",
]);

export function resolve(program: Program): ResolvedProgram {
  const resolver = new Resolver(program);
  return resolver.resolve();
}

class Resolver {
  private diagnostics: Diagnostic[] = [];
  private scopeTable = new ScopeTable();
  private globalScope: Scope = this.scopeTable.createScope("global", null);

  constructor(private program: Program) {}

  resolve(): ResolvedProgram {
    this.declareTypes();
    this.declareConstants();
    this.declareFunctions();
    this.resolveConstants();
    for (const fn of this.program.functions) this.resolveFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return {
      ...this.program,
      symbols: this.scopeTable.getSymbols(),
      scopes: this.scopeTable.getScopes(),
    };
  }

  private declareTypes(): void {
    for (const typeAlias of this.program.typeAliases) {
      this.declare(this.globalScope, typeAlias.name, "type", typeAlias.span);
    }
    for (const interfaceDecl of this.program.interfaces ?? []) {
      this.declare(this.globalScope, interfaceDecl.name, "type", interfaceDecl.span);
    }
    for (const unionDecl of this.program.taggedUnions ?? []) {
      this.declare(this.globalScope, unionDecl.name, "type", unionDecl.span);
    }
    for (const enumDecl of this.program.enums ?? []) {
      this.declare(this.globalScope, enumDecl.name, "type", enumDecl.span);
    }
  }

  private declareConstants(): void {
    for (const constant of taggedUnionTagConstants(this.program.taggedUnions ?? [])) {
      this.declare(this.globalScope, constant.name, "constant", constant.span);
    }
    for (const enumDecl of this.program.enums ?? []) {
      const members = new Set<Str>();
      for (const member of enumDecl.members) {
        if (members.has(member.name)) continue;
        members.add(member.name);
        this.declare(
          this.globalScope,
          enumMemberSymbolName(enumDecl.name, member.name),
          "constant",
          member.span,
        );
      }
    }
    for (const constant of this.program.constants ?? []) {
      this.declare(this.globalScope, constant.name, "constant", constant.span);
    }
  }

  private resolveConstants(): void {
    for (const enumDecl of this.program.enums ?? []) {
      for (const member of enumDecl.members) {
        if (member.initializer) this.resolveExpression(member.initializer, this.globalScope);
      }
    }
    for (const constant of this.program.constants ?? []) {
      this.resolveExpression(constant.initializer, this.globalScope);
    }
  }

  private declareFunctions(): void {
    const groups = new Map<Str, { declared: b8; implemented: b8 }>();
    for (const fn of this.program.functions) {
      const group = groups.get(fn.name) ?? { declared: false, implemented: false };
      if (!group.declared) this.declare(this.globalScope, fn.name, "function", fn.span);
      if (fn.overload !== true && group.implemented) {
        this.diagnostics.push({
          message: `Duplicate function '${fn.name}'`,
          code: DUPLICATE_FUNCTION,
          span: fn.span,
        });
      }
      groups.set(fn.name, {
        declared: true,
        implemented: group.implemented || fn.overload !== true,
      });
    }
  }

  private resolveFunction(fn: FunctionDecl): void {
    const scope = this.scopeTable.createScope("function", this.globalScope);
    for (const param of fn.params) this.declare(scope, param.name, "parameter", param.span);
    for (const param of fn.params) {
      if (param.defaultValue) this.resolveExpression(param.defaultValue, scope);
    }
    if (!fn.body) return;
    for (const statement of fn.body.statements) this.resolveStatement(statement, scope);
  }

  private resolveStatement(statement: Statement, scope: Scope): void {
    switch (statement.kind) {
      case "EmptyStmt":
        return;
      case "ReturnStmt":
        if (statement.expression) this.resolveExpression(statement.expression, scope);
        return;
      case "DeferStmt":
        this.resolveExpression(statement.expression, scope);
        return;
      case "ExpressionStmt":
        this.resolveExpression(statement.expression, scope);
        return;
      case "BreakStmt":
      case "ContinueStmt":
        return;
      case "VarDeclStmt":
        this.resolveExpression(statement.initializer, scope);
        this.declare(scope, statement.name, "local", statement.span);
        return;
      case "RecordRestStmt":
        this.resolveExpression(statement.source, scope);
        for (const name of statement.names) this.declare(scope, name, "local", statement.span);
        if (statement.restName !== null) {
          this.declare(scope, statement.restName, "local", statement.span);
        }
        return;
      case "ArrayDestructureStmt":
        this.resolveExpression(statement.source, scope);
        for (const name of statement.names) this.declare(scope, name, "local", statement.span);
        return;
      case "AssignmentStmt":
        this.resolveAssignmentTarget(statement.target, scope);
        this.resolveExpression(statement.expression, scope);
        return;
      case "IncDecStmt":
        this.resolveAssignmentTarget(statement.target, scope);
        return;
      case "SwitchStmt":
        this.resolveExpression(statement.expression, scope);
        for (const switchCase of statement.cases) {
          for (const label of switchCase.labels) this.resolveExpression(label, scope);
          this.resolveBlock(switchCase.statements, scope);
        }
        if (statement.defaultCase) this.resolveBlock(statement.defaultCase.statements, scope);
        return;
      case "WhileStmt":
        this.resolveExpression(statement.condition, scope);
        this.resolveBlock(statement.body.statements, scope);
        return;
      case "DoWhileStmt":
        this.resolveBlock(statement.body.statements, scope);
        this.resolveExpression(statement.condition, scope);
        return;
      case "ForStmt":
        this.resolveFor(statement, scope);
        return;
      case "ForOfStmt":
        this.resolveForOf(statement, scope);
        return;
      case "ForInStmt":
        this.resolveForIn(statement, scope);
        return;
      case "IfStmt":
        this.resolveExpression(statement.condition, scope);
        this.resolveBlock(statement.thenBody.statements, scope);
        if (statement.elseBody) this.resolveBlock(statement.elseBody.statements, scope);
        return;
    }
  }

  private resolveBlock(statements: Statement[], parent: Scope): void {
    const scope = this.scopeTable.createScope("block", parent);
    for (const statement of statements) this.resolveStatement(statement, scope);
  }

  private resolveFor(statement: Extract<Statement, { kind: "ForStmt" }>, parent: Scope): void {
    const scope = this.scopeTable.createScope("block", parent);
    if (statement.initializer) this.resolveStatement(statement.initializer, scope);
    this.resolveExpression(statement.condition, scope);
    if (statement.update) this.resolveStatement(statement.update, scope);
    this.resolveBlock(statement.body.statements, scope);
  }

  private resolveForOf(statement: Extract<Statement, { kind: "ForOfStmt" }>, parent: Scope): void {
    this.resolveExpression(statement.iterable, parent);
    const scope = this.scopeTable.createScope("block", parent);
    this.declare(scope, statement.name, "local", statement.span);
    this.resolveBlock(statement.body.statements, scope);
  }

  private resolveForIn(statement: Extract<Statement, { kind: "ForInStmt" }>, parent: Scope): void {
    if (!this.isEnumNamespaceExpression(statement.iterable)) {
      this.resolveExpression(statement.iterable, parent);
    }
    const scope = this.scopeTable.createScope("block", parent);
    this.declare(scope, statement.name, "local", statement.span);
    this.resolveBlock(statement.body.statements, scope);
  }

  private isEnumNamespaceExpression(expression: Expression): b8 {
    if (expression.kind !== "IdentifierExpr") return false;
    return this.program.enums?.some((enumDecl) => enumDecl.name === expression.name) ?? false;
  }

  private resolveAssignmentTarget(
    target: Extract<Statement, { kind: "AssignmentStmt" | "IncDecStmt" }>["target"],
    scope: Scope,
  ): void {
    switch (target.kind) {
      case "IdentifierExpr":
        this.requireSymbol(scope, target.name, target.span);
        return;
      case "FieldAccessExpr":
        this.resolveAssignmentTargetOperand(target.operand, scope);
        return;
      case "IndexExpr":
        this.resolveAssignmentTargetOperand(target.operand, scope);
        this.resolveExpression(target.index, scope);
        return;
      case "PostfixPointerExpr":
        this.resolveExpression(target.operand, scope);
        return;
    }
  }

  private resolveAssignmentTargetOperand(expression: Expression, scope: Scope): void {
    if (
      expression.kind === "IdentifierExpr" || expression.kind === "FieldAccessExpr" ||
      expression.kind === "IndexExpr"
    ) {
      this.resolveAssignmentTarget(expression, scope);
      return;
    }
    this.resolveExpression(expression, scope);
  }

  private resolveExpression(expression: Expression, scope: Scope): void {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "StringLiteral":
      case "ZeroValueExpr":
        return;
      case "ArrowFunctionExpr":
        this.resolveArrowFunctionExpression(expression, scope);
        return;
      case "IdentifierExpr":
        this.requireSymbol(scope, expression.name, expression.span);
        return;
      case "UnaryExpr":
        this.resolveExpression(expression.operand, scope);
        return;
      case "BinaryExpr":
        this.resolveExpression(expression.left, scope);
        this.resolveExpression(expression.right, scope);
        return;
      case "ConditionalExpr":
        this.resolveExpression(expression.condition, scope);
        this.resolveExpression(expression.whenTrue, scope);
        this.resolveExpression(expression.whenFalse, scope);
        return;
      case "NullishCoalesceExpr":
        this.resolveExpression(expression.left, scope);
        this.resolveExpression(expression.fallback, scope);
        return;
      case "CastExpr":
      case "SatisfiesExpr":
        this.resolveExpression(expression.expression, scope);
        return;
      case "CallExpr":
        if (!builtinFunctions.has(expression.callee)) {
          this.requireSymbol(scope, expression.callee, expression.span);
        }
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "NewExpr":
        this.requireSymbol(this.globalScope, expression.className, expression.span);
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "MethodCallExpr":
        if (this.isBuiltinMethodCall(expression)) {
          for (const arg of expression.args) this.resolveExpression(arg, scope);
          return;
        }
        if (!this.resolveMethodFunction(expression, scope)) {
          this.resolveExpression(expression.receiver, scope);
        }
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "PostfixPointerExpr":
      case "NonNullAssertExpr":
        this.resolveExpression(expression.operand, scope);
        return;
      case "FieldAccessExpr":
        if (this.resolveQualifiedSymbol(expression, scope)) return;
        this.resolveExpression(expression.operand, scope);
        return;
      case "OptionalFieldAccessExpr":
        this.resolveExpression(expression.operand, scope);
        return;
      case "OptionalMethodCallExpr":
        this.resolveExpression(expression.receiver, scope);
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "OptionalIndexExpr":
        this.resolveExpression(expression.operand, scope);
        this.resolveExpression(expression.index, scope);
        return;
      case "RecordLiteralExpr":
        for (const field of expression.fields) this.resolveExpression(field.expression, scope);
        return;
      case "ArrayLiteralExpr":
        for (const element of expression.elements) this.resolveExpression(element, scope);
        return;
      case "IndexExpr":
        this.resolveExpression(expression.operand, scope);
        this.resolveExpression(expression.index, scope);
        return;
    }
  }

  private resolveArrowFunctionExpression(
    expression: Extract<Expression, { kind: "ArrowFunctionExpr" }>,
    scope: Scope,
  ): void {
    const child = this.scopeTable.createScope("block", scope);
    for (const param of expression.params) this.declare(child, param, "local", expression.span);
    this.resolveExpression(expression.body, child);
  }

  private isBuiltinMethodCall(
    expression: Extract<Expression, { kind: "MethodCallExpr" }>,
  ): b8 {
    return expression.receiver.kind === "IdentifierExpr" && expression.receiver.name === "Array" &&
      expression.method === "fill";
  }

  private resolveMethodFunction(
    expression: Extract<Expression, { kind: "MethodCallExpr" }>,
    scope: Scope,
  ): b8 {
    if (expression.receiver.kind !== "IdentifierExpr") return false;
    const name = `${expression.receiver.name}.${expression.method}`;
    return this.scopeTable.lookup(scope, name) !== null;
  }

  private resolveQualifiedSymbol(
    expression: Extract<Expression, { kind: "FieldAccessExpr" }>,
    scope: Scope,
  ): b8 {
    const name = qualifiedExpressionName(expression);
    return name !== null && this.scopeTable.lookup(scope, name) !== null;
  }

  private declare(scope: Scope, name: Str, kind: SymbolKind, span: Diagnostic["span"]): void {
    if (this.scopeTable.declare(scope, name, kind)) return;
    this.diagnostics.push({ message: `Duplicate ${kind} '${name}'`, code: DUPLICATE_SYMBOL, span });
  }

  private requireSymbol(scope: Scope, name: Str, span: Diagnostic["span"]): void {
    if (this.scopeTable.lookup(scope, name)) return;
    this.diagnostics.push({
      message: `Unknown identifier '${name}'`,
      code: UNKNOWN_IDENTIFIER,
      span,
    });
  }
}
