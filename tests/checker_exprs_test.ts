import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { isAddressable, isComparisonOperator, isIntegerZeroLiteral, spanKey } from "checker/exprs.ts";

type Str = string;
type b8 = boolean;
type IntLiteralValue = bigint;

const span: SourceSpan = {
  start: { offset: 3, line: 1, column: 4 },
  end: { offset: 8, line: 1, column: 9 },
};

Deno.test("classifies checker expression operators", () => {
  assertSame(isComparisonOperator("<="), true);
  assertSame(isComparisonOperator("+"), false);
});

Deno.test("classifies integer zero literals", () => {
  assertSame(isIntegerZeroLiteral(integer(0n)), true);
  assertSame(isIntegerZeroLiteral(integer(1n)), false);
  assertSame(isIntegerZeroLiteral(identifier("x")), false);
});

Deno.test("classifies addressable expressions", () => {
  assertSame(isAddressable(identifier("x")), true);
  assertSame(isAddressable({ kind: "IndexExpr", operand: identifier("xs"), index: integer(0n), span }), true);
  assertSame(isAddressable({ kind: "FieldAccessExpr", operand: identifier("p"), field: "x", span }), true);
  assertSame(isAddressable({ kind: "PostfixPointerExpr", operator: ".*", operand: identifier("p"), span }), true);
  assertSame(isAddressable({ kind: "PostfixPointerExpr", operator: ".&", operand: identifier("p"), span }), false);
  assertSame(isAddressable(integer(1n)), false);
});

Deno.test("builds checker span keys", () => {
  assertText(spanKey(span), "3:8");
});

function integer(value: IntLiteralValue): Expression {
  return { kind: "IntegerLiteral", value, text: value.toString(), span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
