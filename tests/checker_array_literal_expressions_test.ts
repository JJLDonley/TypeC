import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayLiteralExpression } from "checker/array_literal_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks array literal expressions", () => {
  const result = checkArrayLiteralExpression(
    array([integer("1"), integer("2")]),
    "i32[]",
    resolveExpected,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32[2]");
});

Deno.test("reports invalid array literal expressions", () => {
  const badTarget = checkArrayLiteralExpression(array([integer("1")]), "i32", resolveExpected);
  const badLength = checkArrayLiteralExpression(array([integer("1")]), "i32[2]", resolveExpected);

  assertText(
    badTarget.diagnostics[0]?.message ?? "",
    "Array literal is not assignable to non-array type 'i32'",
  );
  assertText(badTarget.type, "<error>");
  assertText(
    badLength.diagnostics[0]?.message ?? "",
    "Array length 1 is not assignable to 'i32[2]'",
  );
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function array(elements: Expression[]): Extract<Expression, { kind: "ArrayLiteralExpr" }> {
  return { kind: "ArrayLiteralExpr", elements, span };
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
