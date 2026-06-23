import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkNonNullAssertExpression } from "checker/non_null_assertions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks non-null assertions", () => {
  const result = checkNonNullAssertExpression(nonNullAssert(identifier("value")), typeOf);

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports non-optional non-null assertions", () => {
  const result = checkNonNullAssertExpression(nonNullAssert(identifier("plain")), typeOf);

  assertText(result.type, "<error>");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Non-null assertion requires optional type, got 'i32'",
  );
});

function typeOf(expr: Expression): TypeName {
  if (expr.kind === "IdentifierExpr" && expr.name === "value") return "i32?";
  if (expr.kind === "IdentifierExpr" && expr.name === "plain") return "i32";
  return "<error>";
}

function nonNullAssert(operand: Expression): Extract<Expression, { kind: "NonNullAssertExpr" }> {
  return { kind: "NonNullAssertExpr", operand, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
