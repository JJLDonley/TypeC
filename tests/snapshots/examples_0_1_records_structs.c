#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;
typedef int8_t   i8;
typedef int16_t  i16;
typedef int32_t  i32;
typedef int64_t  i64;
typedef float    f32;
typedef double   f64;
typedef bool     b8;
typedef size_t   usize;
typedef i8 c_char;
typedef i8 c_schar;
typedef u8 c_uchar;
typedef i16 c_short;
typedef u16 c_ushort;
typedef i32 c_int;
typedef u32 c_uint;
typedef i64 c_long;
typedef u64 c_ulong;
typedef i64 c_longlong;
typedef u64 c_ulonglong;
typedef f32 c_float;
typedef f64 c_double;

typedef struct {
  i32 left;
  i32 right;
} Pair;

typedef struct Point {
  i32 x;
  i32 y;
} Point;

static i32 sum(Pair pair, Point point);
i32 main(void);

static i32 sum(Pair pair, Point point) {
  return pair.left + pair.right + point.x + point.y;
}

i32 main(void) {
  const Pair pair = (Pair){ .left = 10, .right = 20 };
  const Point point = (Point){ .x = 5, .y = 7 };
  if (sum(pair, point) == 42) {
    return 0;
  }
  return 1;
}
