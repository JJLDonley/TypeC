import type { Expression } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { checkArrayInitializer } from "../src/checker_array_initializers.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts array literal array initializers", () => {
  assertLen(checkArrayInitializer(arrayLiteral(), "i32[2]", span).length, 0);
});

Deno.test("rejects non-literal array initializers", () => {
  const diagnostics = checkArrayInitializer(identifier("xs"), "i32[2]", span);

  assertText(diagnostics[0]?.message ?? "", "Array variable initializer must be an array literal");
});

Deno.test("ignores non-array initializers", () => {
  assertLen(checkArrayInitializer(identifier("x"), "i32", span).length, 0);
});

function arrayLiteral(): Expression {
  return { kind: "ArrayLiteralExpr", elements: [], span };
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
