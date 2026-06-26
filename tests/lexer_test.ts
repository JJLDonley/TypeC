import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";

type Str = string;
type b8 = boolean;

Deno.test("lexes low-level punctuation and postfix pointer operators", () => {
  const texts = tokenTexts("value.& ptr.* i32[] i32[16] T* T&");
  assertEqualText(texts, [
    "value",
    ".&",
    "ptr",
    ".*",
    "i32",
    "[",
    "]",
    "i32",
    "[",
    "16",
    "]",
    "T",
    "*",
    "T",
    "&",
    "",
  ]);
});

Deno.test("lexes function type arrow", () => {
  assertEqualText(tokenTexts("(x: i32) => i32"), ["(", "x", ":", "i32", ")", "=>", "i32", ""]);
});

Deno.test("lexes rest parameter operator", () => {
  assertEqualText(tokenTexts("...args"), ["...", "args", ""]);
});

Deno.test("lexes bitwise operators", () => {
  assertEqualText(tokenTexts("~a & b | c ^ d << e >> f >>> g"), [
    "~",
    "a",
    "&",
    "b",
    "|",
    "c",
    "^",
    "d",
    "<<",
    "e",
    ">>",
    "f",
    ">>>",
    "g",
    "",
  ]);
});

Deno.test("lexes logical binary operators", () => {
  assertEqualText(tokenTexts("a && b || c"), ["a", "&&", "b", "||", "c", ""]);
});

Deno.test("lexes compound assignment operators", () => {
  assertEqualText(tokenTexts("a += b <<= c >>>= d |= e"), [
    "a",
    "+=",
    "b",
    "<<=",
    "c",
    ">>>=",
    "d",
    "|=",
    "e",
    "",
  ]);
});

Deno.test("lexes increment and decrement operators", () => {
  assertEqualText(tokenTexts("a++ --b"), ["a", "++", "--", "b", ""]);
});

Deno.test("lexes float literals", () => {
  const tokens = lex("1 2.5 3.");
  assertEqualText(tokens.map((token) => token.kind), [
    "integer",
    "float",
    "integer",
    "punctuation",
    "eof",
  ]);
  assertEqualText(tokens.map((token) => token.text), ["1", "2.5", "3", ".", ""]);
});

Deno.test("lexes string literals", () => {
  const tokens = lex(`"./math.tc"`);
  assertEqualText(tokens.map((token) => token.kind), ["string", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["./math.tc", ""]);
});

Deno.test("lexes single-quoted string literals", () => {
  const tokens = lex(`'hello'`);
  assertEqualText(tokens.map((token) => token.kind), ["string", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["hello", ""]);
});

Deno.test("lexes escaped string literals", () => {
  const tokens = lex(`"a\\n\\t\\\"" 'b\\n\\t\\\''`);
  assertEqualText(tokens.map((token) => token.kind), ["string", "string", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ['a\n\t"', "b\n\t'", ""]);
});

Deno.test("preserves unknown string escapes", () => {
  const tokens = lex(`"path\\file"`);
  assertEqualText(tokens.map((token) => token.text), ["path\\file", ""]);
});

Deno.test("lexes plain template literals", () => {
  const tokens = lex("`hello\nTypeC`");
  assertEqualText(tokens.map((token) => token.kind), ["string", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["hello\nTypeC", ""]);
});

Deno.test("lexes static template interpolation", () => {
  const tokens = lex('`hello ${"TypeC"} ${42} ${true}`');
  assertEqualText(tokens.map((token) => token.kind), ["string", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["hello TypeC 42 true", ""]);
});

Deno.test("rejects runtime template interpolation", () => {
  assertLexError("`hello ${name}`");
});

Deno.test("lexes numeric separators", () => {
  const tokens = lex("1_000 12_345.67_89");
  assertEqualText(tokens.map((token) => token.kind), ["integer", "float", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["1000", "12345.6789", ""]);
});

Deno.test("rejects invalid numeric separators", () => {
  assertLexError("1__000");
  assertLexError("1_");
  assertLexError("1_.5");
});

function tokenTexts(source: Str): Str[] {
  return lex(source).map((token) => token.text);
}

function assertLexError(source: Str): void {
  try {
    lex(source);
  } catch (error) {
    if (error instanceof TypeCError) return;
    throw error;
  }
  throw new Error("Expected lexer error");
}

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
