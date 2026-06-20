import { mapCHeaderConstantType } from "c/header/constant_types.ts";

type Str = string;

Deno.test("maps fixed C array constant types", () => {
  assertSame(mapCHeaderConstantType("const unsigned char[3]"), "Array<u8, 3>");
  assertSame(mapCHeaderConstantType("const int32_t[2][3]"), "Array<Array<i32, 3>, 2>");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
