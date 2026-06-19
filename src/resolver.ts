import type { Diagnostic } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Expression, FunctionDecl, Program, Statement } from "./ast.ts";
import type { ResolvedProgram, SymbolKind } from "./rast.ts";
import { type Scope, ScopeTable } from "./scope.ts";

type Str = string;

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
    this.declareFunctions();
    for (const fn of this.program.functions) this.resolveFunction(fn);
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { ...this.program, symbols: this.scopeTable.getSymbols(), scopes: this.scopeTable.getScopes() };
  }

  private declareFunctions(): void {
    for (const fn of this.program.functions) this.declare(this.globalScope, fn.name, "function", fn.span);
  }

  private resolveFunction(fn: FunctionDecl): void {
    const scope = this.scopeTable.createScope("function", this.globalScope);
    for (const param of fn.params) this.declare(scope, param.name, "parameter", param.span);
    for (const statement of fn.body.statements) this.resolveStatement(statement, scope);
  }

  private resolveStatement(statement: Statement, scope: Scope): void {
    switch (statement.kind) {
      case "ReturnStmt":
        this.resolveExpression(statement.expression, scope);
        return;
      case "VarDeclStmt":
        this.resolveExpression(statement.initializer, scope);
        this.declare(scope, statement.name, "local", statement.span);
        return;
    }
  }

  private resolveExpression(expression: Expression, scope: Scope): void {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
        return;
      case "IdentifierExpr":
        this.requireSymbol(scope, expression.name, expression.span);
        return;
      case "BinaryExpr":
        this.resolveExpression(expression.left, scope);
        this.resolveExpression(expression.right, scope);
        return;
      case "CallExpr":
        this.requireSymbol(this.globalScope, expression.callee, expression.span);
        for (const arg of expression.args) this.resolveExpression(arg, scope);
        return;
      case "PostfixPointerExpr":
        this.resolveExpression(expression.operand, scope);
        return;
    }
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
