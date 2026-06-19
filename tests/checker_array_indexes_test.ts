import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import { checkArrayIndex } from "checker/array_indexes.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts integer array indexes inside bounds", () => {
  assertLen(checkArrayIndex(integer("1"), "usize", 2n).length, 0);
  assertLen(checkArrayIndex(identifier("i"), "i32", 2n).length, 0);
});

Deno.test("reports invalid array indexes", () => {
  const typeDiagnostics = checkArrayIndex(integer("1"), "f64", 2n);
  const boundsDiagnostics = checkArrayIndex(integer("2"), "usize", 2n);

  assertText(typeDiagnostics[0]?.message ?? "", "Array index type 'f64' is not an integer");
  assertText(boundsDiagnostics[0]?.message ?? "", "Array index 2 is out of bounds for length 2");
});

function integer(text: Str): Extract<Expression, { kind: "IntegerLiteral" }> {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function identifier(name: Str): Extract<Expression, { kind: "IdentifierExpr" }> {
  return { kind: "IdentifierExpr", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
