type Str = string;

const cPreludeIncludes: Str[] = [
  "#include <stdint.h>",
  "#include <stdbool.h>",
  "#include <stddef.h>",
];

const fixedWidthAliases: Str[] = [
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
];

const cAbiAliases: Str[] = [
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
];

export function emitCPrelude(): Str[] {
  return [...cPreludeIncludes, "", ...fixedWidthAliases, ...cAbiAliases, ""];
}
