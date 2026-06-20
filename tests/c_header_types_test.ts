import { TypeCError } from "core/diagnostics.ts";
import { mapCHeaderType } from "c/header/types.ts";

type Str = string;

Deno.test("maps supported C header types", () => {
  assertSame(mapCHeaderType("int32_t"), "i32");
  assertSame(mapCHeaderType("__uint64_t"), "u64");
  assertSame(mapCHeaderType("const char *restrict"), "u8*");
  assertSame(mapCHeaderType("void * _Nullable"), "void*");
  assertSame(mapCHeaderType("_Bool"), "b8");
  assertSame(mapCHeaderType("size_t"), "usize");
  assertSame(mapCHeaderType("int"), "c_int");
  assertSame(mapCHeaderType("unsigned long"), "c_ulong");
  assertSame(mapCHeaderType("int32_t[4]"), "i32[]");
  assertSame(mapCHeaderType("const char [static 8]"), "u8[]");
});

Deno.test("maps C header record types", () => {
  const records = new Set<Str>(["Color"]);

  assertSame(mapCHeaderType("Color", records), "Color");
  assertSame(mapCHeaderType("struct Color *", records), "Color*");
});

Deno.test("rejects unsupported C header types", () => {
  try {
    mapCHeaderType("__unsupported_t");
  } catch (error) {
    if (
      error instanceof TypeCError &&
      error.diagnostics.some((diagnostic) =>
        diagnostic.message === "Unsupported C type '__unsupported_t'"
      )
    ) return;
  }
  throw new Error("Expected unsupported C type error");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
