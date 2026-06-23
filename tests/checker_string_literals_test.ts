import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import {
  checkStringLiteralTarget,
  isStringLiteralArrayInitializer,
  stringLiteralType,
} from "checker/string_literals.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks C string literal types", () => {
  const literal = stringLiteral("hello");

  assertText(stringLiteralType(literal), "u8[6]");
  assertLen(checkStringLiteralTarget("u8[6]", "u8*", literal).length, 0);
  assertLen(checkStringLiteralTarget("u8[6]", "void*", literal).length, 0);
  assertLen(checkStringLiteralTarget("u8[6]", "u8[]", literal).length, 0);
  assertLen(checkStringLiteralTarget("u8[6]", "u8[6]", literal).length, 0);
  assertSame(isStringLiteralArrayInitializer(literal, "u8[]"), true);
});

Deno.test("reports invalid C string literal targets", () => {
  const literal = stringLiteral("hello");
  const diagnostics = checkStringLiteralTarget("u8[6]", "i32", literal);
  const lengthDiagnostics = checkStringLiteralTarget("u8[6]", "u8[5]", literal);

  assertText(diagnostics[0]?.message ?? "", "String literal is not assignable to 'i32'");
  assertText(
    lengthDiagnostics[0]?.message ?? "",
    "String literal length 6 is not assignable to 'u8[5]'",
  );
});

function stringLiteral(text: Str): Extract<Expression, { kind: "StringLiteral" }> {
  return { kind: "StringLiteral", text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
