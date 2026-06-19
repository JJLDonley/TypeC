import { TypeCError } from "../src/diagnostics.ts";
import { mapCHeaderType } from "../src/c_header_types.ts";

type Str = string;

Deno.test("maps supported C header types", () => {
  assertSame(mapCHeaderType("int32_t"), "i32");
  assertSame(mapCHeaderType("__uint64_t"), "u64");
  assertSame(mapCHeaderType("const char *restrict"), "u8*");
  assertSame(mapCHeaderType("void * _Nullable"), "void*");
  assertSame(mapCHeaderType("_Bool"), "b8");
  assertSame(mapCHeaderType("size_t"), "usize");
});

Deno.test("rejects unsupported C header types", () => {
  try {
    mapCHeaderType("long");
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === "Unsupported C type 'long'")) return;
  }
  throw new Error("Expected unsupported C type error");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
