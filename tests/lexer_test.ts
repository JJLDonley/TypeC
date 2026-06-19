import { lex } from "../src/lexer.ts";

type Str = string;
type b8 = boolean;

Deno.test("lexes low-level punctuation and postfix pointer operators", () => {
  const texts = tokenTexts("value.& ptr.* i32[] i32[16] T* T&");
  assertEqualText(texts, ["value", ".&", "ptr", ".*", "i32", "[", "]", "i32", "[", "16", "]", "T", "*", "T", "&", ""]);
});

Deno.test("lexes float literals", () => {
  const tokens = lex("1 2.5 3.");
  assertEqualText(tokens.map((token) => token.kind), ["integer", "float", "integer", "punctuation", "eof"]);
  assertEqualText(tokens.map((token) => token.text), ["1", "2.5", "3", ".", ""]);
});

function tokenTexts(source: Str): Str[] {
  return lex(source).map((token) => token.text);
}

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
