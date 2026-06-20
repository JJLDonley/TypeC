import type { FunctionDecl, Statement, TypeAliasDecl } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitExpressionStatement } from "emitter/expression_statements.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits expression statements", () => {
  assertText(emitExpressionStatement(statement("tick"), context()), "tick();");
});

function statement(callee: Str): Extract<Statement, { kind: "ExpressionStmt" }> {
  return {
    kind: "ExpressionStmt",
    expression: { kind: "CallExpr", callee, args: [], span },
    span,
  };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
