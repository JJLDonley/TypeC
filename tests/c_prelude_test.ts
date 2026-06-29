import { emitCPrelude } from "c/prelude.ts";

type Str = string;

Deno.test("emits required C prelude", () => {
  assertLines(emitCPrelude(), [
    "#include <stdint.h>",
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "typedef uint8_t  u8;",
    "typedef uint16_t u16;",
    "typedef uint32_t u32;",
    "typedef uint64_t u64;",
    "typedef int8_t   i8;",
    "typedef int16_t  i16;",
    "typedef int32_t  i32;",
    "typedef int64_t  i64;",
    "typedef float    f32;",
    "typedef double   f64;",
    "typedef bool     b8;",
    "typedef size_t   usize;",
    "typedef i8 c_char;",
    "typedef i8 c_schar;",
    "typedef u8 c_uchar;",
    "typedef i16 c_short;",
    "typedef u16 c_ushort;",
    "typedef i32 c_int;",
    "typedef u32 c_uint;",
    "typedef i64 c_long;",
    "typedef u64 c_ulong;",
    "typedef i64 c_longlong;",
    "typedef u64 c_ulonglong;",
    "typedef f32 c_float;",
    "typedef f64 c_double;",
  ]);
});

function assertLines(lines: Str[], expectedLines: Str[]): void {
  const text = lines.join("\n");
  for (const line of expectedLines) assertIncludes(text, line);
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
