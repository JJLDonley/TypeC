import {
  cArrayElementType,
  cArrayType,
  isFixedCArraySize,
  isNestedCArrayType,
} from "c/header/array_types.ts";
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
  assertSame(cArrayElementType("int32_t[2][3]") ?? "", "int32_t[3]");
});

Deno.test("extracts C array sizes", () => {
  assertSame(cArrayType("int32_t[4]")?.size ?? "", "4");
  assertSame(cArrayType("char[static 8]")?.size ?? "", "static 8");
  assertSame(cArrayType("int32_t[2][3]")?.size ?? "", "2");
});

Deno.test("detects fixed C array sizes", () => {
  assertSame(isFixedCArraySize("4") ? "yes" : "no", "yes");
  assertSame(isFixedCArraySize("static 8") ? "yes" : "no", "no");
  assertSame(isFixedCArraySize("") ? "yes" : "no", "no");
});

Deno.test("detects nested C array types", () => {
  assertSame(isNestedCArrayType("int32_t[2]") ? "yes" : "no", "no");
  assertSame(isNestedCArrayType("int32_t[2][3]") ? "yes" : "no", "yes");
});

Deno.test("maps scalar C header types", () => {
  assertSame(mapScalarCHeaderType("void") ?? "", "void");
  assertSame(mapScalarCHeaderType("uint32_t") ?? "", "u32");
  assertSame(mapScalarCHeaderType("__int64_t") ?? "", "i64");
  assertSame(mapScalarCHeaderType("i32") ?? "", "i32");
  assertSame(mapScalarCHeaderType("signed char") ?? "", "i8");
  assertSame(mapScalarCHeaderType("unsigned int") ?? "", "c_uint");
  assertSame(mapScalarCHeaderType("signed long long int") ?? "", "c_longlong");
  assertSame(mapScalarCHeaderType("bool") ?? "", "bool");
  assertSame(mapScalarCHeaderType("size_t") ?? "", "usize");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
