import { cArrayElementType, cPrecedence, emitIntegerLiteralExpression } from "emitter/helpers.ts";

type Str = string;
type usize = number;

Deno.test("reads emitted C array element types", () => {
  assertText(cArrayElementType("i32[3]") ?? "", "i32");
  assertText(cArrayElementType("Pair[12]") ?? "", "Pair");
  assertText(cArrayElementType("i32[]") ?? "none", "none");
});

Deno.test("emits wide integer literal macros", () => {
  assertText(
    emitIntegerLiteralExpression(
      { value: 9223372036854775808n, text: "9223372036854775808" },
      "u64",
    ),
    "UINT64_C(9223372036854775808)",
  );
  assertText(
    emitIntegerLiteralExpression({ value: 2147483648n, text: "2147483648" }, "i64"),
    "INT64_C(2147483648)",
  );
  assertText(
    emitIntegerLiteralExpression({ value: 2147483648n, text: "2147483648" }, "u32"),
    "UINT32_C(2147483648)",
  );
  assertText(emitIntegerLiteralExpression({ value: 1n, text: "1" }, "i32"), "1");
});

Deno.test("reports emitted C expression precedence", () => {
  assertSize(cPrecedence("*"), 11);
  assertSize(cPrecedence("+"), 10);
  assertSize(cPrecedence("<<"), 9);
  assertSize(cPrecedence("<="), 8);
  assertSize(cPrecedence("=="), 7);
  assertSize(cPrecedence("&"), 6);
  assertSize(cPrecedence("^"), 5);
  assertSize(cPrecedence("|"), 4);
  assertSize(cPrecedence("&&"), 3);
  assertSize(cPrecedence("||"), 2);
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSize(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
