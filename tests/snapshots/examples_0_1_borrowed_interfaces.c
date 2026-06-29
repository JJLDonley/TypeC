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

typedef struct Readable {
  void* self;
  i32 (*get)(void*);
} Readable;

typedef struct {
  i32 value;
} Box;

static i32 read(Readable value);
i32 main(void);
static i32 Box_get(Box* this);

static i32 Box_as_Readable_get(void* self) {
  return Box_get((Box*)self);
}

static i32 read(Readable value) {
  return value.get(value.self);
}

i32 main(void) {
  const Box box = (Box){ .value = 42 };
  const Readable readable = (Readable){ .self = &box, .get = Box_as_Readable_get };
  if (read(readable) == 42) {
    return 0;
  }
  return 1;
}

static i32 Box_get(Box* this) {
  return this->value;
}
