import type { SourceSpan } from "../src/diagnostics.ts";
import { parseFloatLiteral, precedence, span } from "../src/parser_helpers.ts";

type Str = string;
type i32 = number;
type f64 = number;

Deno.test("parses parser float literals", () => {
  assertFloat(parseFloatLiteral("1.5"), 1.5);
});

Deno.test("reports parser binary precedence", () => {
  assertInt(precedence("*"), 20);
  assertInt(precedence("+"), 10);
  assertInt(precedence("=="), 5);
  assertInt(precedence("?"), -1);
});

Deno.test("builds parser spans", () => {
  const built = span({ offset: 1, line: 1, column: 2 }, { offset: 3, line: 1, column: 4 });
  assertText(spanText(built), "1:3");
});

function spanText(value: SourceSpan): Str {
  return `${value.start.offset}:${value.end.offset}`;
}

function assertFloat(actual: f64, expected: f64): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertInt(actual: i32, expected: i32): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
