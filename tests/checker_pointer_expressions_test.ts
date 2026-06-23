import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkPostfixPointerExpression } from "checker/pointer_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks postfix pointer expressions", () => {
  const address = checkPostfixPointerExpression(pointerExpr(identifier("value"), ".&"), "i32");
  const dereference = checkPostfixPointerExpression(pointerExpr(identifier("ptr"), ".*"), "i32*");

  assertLen(address.diagnostics.length, 0);
  assertText(address.type, "i32&");
  assertLen(dereference.diagnostics.length, 0);
  assertText(dereference.type, "i32");
});

Deno.test("reports invalid postfix pointer expressions", () => {
  const result = checkPostfixPointerExpression(pointerExpr(integer("1"), ".&"), "i32");

  assertText(
    result.diagnostics[0]?.message ?? "",
    "Cannot take address of non-addressable expression",
  );
  assertText(result.type, "i32&");
});

function pointerExpr(
  operand: Expression,
  operator: ".&" | ".*",
): Extract<Expression, { kind: "PostfixPointerExpr" }> {
  return { kind: "PostfixPointerExpr", operand, operator, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
