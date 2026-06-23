import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkUnaryExpression } from "checker/unary_expressions.ts";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

type Str = string;
type usize = number;

Deno.test("checks logical not expressions", () => {
  const result = checkUnaryExpression(unary("!", identifier("closed")), () => "bool");

  assertText(result.type, "bool");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("rejects logical not on non-bool expressions", () => {
  const result = checkUnaryExpression(unary("!", identifier("value")), () => "i32");

  assertText(result.type, "<error>");
  assertText(result.diagnostics[0]?.message ?? "", "Operator '!' requires a bool operand");
});

Deno.test("keeps numeric unary expressions", () => {
  const result = checkUnaryExpression(unary("-", identifier("value")), () => "i32");

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("checks bitwise not expressions", () => {
  const result = checkUnaryExpression(unary("~", identifier("value")), () => "u32");

  assertText(result.type, "u32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("rejects bitwise not on non-integer expressions", () => {
  const result = checkUnaryExpression(unary("~", identifier("value")), () => "f32");

  assertText(result.type, "<error>");
  assertText(result.diagnostics[0]?.message ?? "", "Operator '~' requires an integer operand");
});

function unary(
  operator: "+" | "-" | "!" | "~",
  operand: Expression,
): Extract<Expression, { kind: "UnaryExpr" }> {
  return { kind: "UnaryExpr", operator, operand, span };
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
