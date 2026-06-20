import { cArrayElementType } from "c/header/array_types.ts";
import { mapScalarCHeaderType } from "c/header/scalar_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";

type Str = string;

Deno.test("normalizes C header type spelling", () => {
  assertSame(normalizeCHeaderType("const char * restrict _Nullable"), "char*");
  assertSame(normalizeCHeaderType("volatile int32_t [ static 4 ]"), "int32_t[static 4]");
});

Deno.test("extracts C array element types", () => {
  assertSame(cArrayElementType("int32_t[4]") ?? "", "int32_t");
  assertSame(cArrayElementType("char[static 8]") ?? "", "char");
});

Deno.test("maps scalar C header types", () => {
  assertSame(mapScalarCHeaderType("uint32_t") ?? "", "u32");
  assertSame(mapScalarCHeaderType("signed char") ?? "", "i8");
  assertSame(mapScalarCHeaderType("unsigned int") ?? "", "c_uint");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
