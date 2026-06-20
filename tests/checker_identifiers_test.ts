import type { SourceSpan } from "core/diagnostics.ts";
import { checkIdentifierType } from "checker/identifiers.ts";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

type Str = string;
type usize = number;

Deno.test("resolves local identifier types", () => {
  const result = checkIdentifierType("value", { type: "i32", mutable: false }, undefined, span);

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("reports unknown identifiers", () => {
  const result = checkIdentifierType("missing", undefined, undefined, span);

  assertLen(result.diagnostics.length, 1);
  assertText(result.diagnostics[0]?.message ?? "", "Unknown identifier 'missing'");
  assertText(result.type, "<error>");
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
