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
    "typedef char c_char;",
    "typedef signed char c_schar;",
    "typedef unsigned char c_uchar;",
    "typedef short c_short;",
    "typedef unsigned short c_ushort;",
    "typedef int c_int;",
    "typedef unsigned int c_uint;",
    "typedef long c_long;",
    "typedef unsigned long c_ulong;",
    "typedef long long c_longlong;",
    "typedef unsigned long long c_ulonglong;",
    "typedef float c_float;",
    "typedef double c_double;",
  ]);
});

function assertLines(lines: Str[], expectedLines: Str[]): void {
  const text = lines.join("\n");
  for (const line of expectedLines) assertIncludes(text, line);
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
