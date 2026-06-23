import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Expression, FunctionDecl, Program, Statement } from "core/ast.ts";
import { enumMemberSymbolName } from "core/enums.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import type { ResolvedProgram, SymbolKind } from "core/rast.ts";
import { type Scope, ScopeTable } from "core/scope.ts";

type Str = string;
type b8 = boolean;

const builtinFunctions = new Set<Str>(["arenaCreate", "arenaDestroy", "arenaAlloc"]);

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
    for (const fn of this.program.functions) {
      this.declare(this.globalScope, fn.name, "function", fn.span);
    }
  }

  private resolveFunction(fn: FunctionDecl): void {
    const scope = this.scopeTable.createScope("function", this.globalScope);
    for (const param of fn.params) this.declare(scope, param.name, "parameter", param.span);
    if (!fn.body) return;
    for (const statement of fn.body.statements) this.resolveStatement(statement, scope);
  }

  private resolveStatement(statement: Statement, scope: Scope): void {
    switch (statement.kind) {
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
        return;
      case "VarDeclStmt":
        this.resolveExpression(statement.initializer, scope);
        this.declare(scope, statement.name, "local", statement.span);
        return;
      case "AssignmentStmt":
        this.requireSymbol(scope, statement.name, statement.span);
        this.resolveExpression(statement.expression, scope);
        return;
      case "IncDecStmt":
        this.requireSymbol(scope, statement.name, statement.span);
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

  private resolveExpression(expression: Expression, scope: Scope): void {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "StringLiteral":
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
      case "CallExpr":
        if (!builtinFunctions.has(expression.callee)) {
          this.requireSymbol(this.globalScope, expression.callee, expression.span);
        }
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "MethodCallExpr":
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
    this.diagnostics.push({ message: `Duplicate ${kind} '${name}'`, span });
  }

  private requireSymbol(scope: Scope, name: Str, span: Diagnostic["span"]): void {
    if (this.scopeTable.lookup(scope, name)) return;
    this.diagnostics.push({ message: `Unknown identifier '${name}'`, span });
  }
}
