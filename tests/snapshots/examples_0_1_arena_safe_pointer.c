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

#include <stdlib.h>

typedef struct __typec_arena_allocation {
  void* ptr;
  struct __typec_arena_allocation* next;
} __typec_arena_allocation;

typedef struct __typec_arena {
  __typec_arena_allocation* allocations;
} __typec_arena;

static __typec_arena* __typec_arena_create(void) {
  __typec_arena* arena = (__typec_arena*)malloc(sizeof(__typec_arena));
  if (arena == NULL) abort();
  arena->allocations = NULL;
  return arena;
}

static void __typec_arena_destroy(__typec_arena* arena) {
  __typec_arena_allocation* allocation = arena->allocations;
  while (allocation != NULL) {
    __typec_arena_allocation* next = allocation->next;
    free(allocation->ptr);
    free(allocation);
    allocation = next;
  }
  free(arena);
}

static void* __typec_arena_alloc(__typec_arena* arena, usize size) {
  if (size == 0) size = 1;
  void* ptr = malloc(size);
  if (ptr == NULL) abort();
  __typec_arena_allocation* allocation = (__typec_arena_allocation*)malloc(sizeof(__typec_arena_allocation));
  if (allocation == NULL) abort();
  allocation->ptr = ptr;
  allocation->next = arena->allocations;
  arena->allocations = allocation;
  return ptr;
}

i32 main(void);

i32 main(void) {
  const __typec_arena* arena = __typec_arena_create();
  i32* value = ((i32*)__typec_arena_alloc(arena, sizeof(i32) * 1));
  *value = 42;
  const i32 result = *value;
  __typec_arena_destroy(arena);
  if (result == 42) {
    return 0;
  }
  return 1;
}
