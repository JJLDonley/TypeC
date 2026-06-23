import type { Expression, FunctionDecl, Statement, TypeAliasDecl } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitIncDec } from "emitter/inc_dec.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits increment and decrement statements", () => {
  assertText(emitIncDec(incDec("x", "++"), context()), "x++;");
  assertText(emitIncDec(incDec("y", "--"), context()), "y--;");
});

function incDec(
  name: Str,
  operator: Extract<Statement, { kind: "IncDecStmt" }>["operator"],
): Extract<Statement, { kind: "IncDecStmt" }> {
  return { kind: "IncDecStmt", target: identifier(name), operator, span };
}

function identifier(name: Str): Extract<Expression, { kind: "IdentifierExpr" }> {
  return { kind: "IdentifierExpr", name, span };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
