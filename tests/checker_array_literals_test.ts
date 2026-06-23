import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import {
  checkArrayLiteralElementType,
  checkArrayLiteralLength,
  checkArrayLiteralTarget,
  checkInferredArrayLiteral,
} from "checker/array_literals.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks valid array literals", () => {
  const literal = arrayLiteral([integer("1")]);
  const target = checkArrayLiteralTarget("i32[]", literal);

  assertText(target.array?.element ?? "", "i32");
  assertLen(target.diagnostics.length, 0);
  assertLen(checkInferredArrayLiteral(literal, target.array!).length, 0);
  assertLen(checkArrayLiteralElementType("i32", "i32", literal.elements[0]!).length, 0);
  assertLen(
    checkArrayLiteralLength(1, { element: "i32", length: 1n }, "i32[1]", literal).length,
    0,
  );
});

Deno.test("reports invalid array literals", () => {
  const empty = arrayLiteral([]);
  const one = arrayLiteral([integer("1")]);
  const target = checkArrayLiteralTarget("i32", one);
  const inferred = checkInferredArrayLiteral(empty, { element: "i32", length: null });
  const element = checkArrayLiteralElementType("f64", "i32", one.elements[0]!);
  const length = checkArrayLiteralLength(1, { element: "i32", length: 2n }, "i32[2]", one);

  assertText(
    target.diagnostics[0]?.message ?? "",
    "Array literal is not assignable to non-array type 'i32'",
  );
  assertText(inferred[0]?.message ?? "", "Cannot infer empty array type");
  assertText(element[0]?.message ?? "", "Array element type 'f64' is not assignable to 'i32'");
  assertText(length[0]?.message ?? "", "Array length 1 is not assignable to 'i32[2]'");
});

function arrayLiteral(elements: Expression[]): Extract<Expression, { kind: "ArrayLiteralExpr" }> {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function integer(text: Str): Extract<Expression, { kind: "IntegerLiteral" }> {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
