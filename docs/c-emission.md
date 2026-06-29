# TypeC 0.1 C Emission Reference

This document defines the frozen TypeC 0.1 emitted C ABI and emission rules that are observable in
generated C.

## Scalar Prelude

Every translation unit includes the fixed-width, boolean, and size headers and emits the TypeC
scalar typedef prelude:

```c
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
```

TypeC primitive names map one-to-one to these emitted C names. C interop aliases are emitted only in
terms of TypeC fixed-width aliases:

```c
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
```

Generated C for TypeC declarations does not use raw C integer spellings such as `int`, `long`, or
`unsigned`; it uses TypeC typedef names. `<stdlib.h>` is emitted only when runtime helpers require
standard-library functions, currently arena helpers and optional unwrap helpers that call `abort()`.

## Translation Unit Ordering and Identifiers

Each translation unit is emitted in dependency-safe order:

1. required headers and scalar typedefs
2. arena runtime only when used
3. borrowed-interface view typedefs
4. enum typedefs
5. regular type aliases and generated record/slice/tuple/optional helpers
6. tagged-union typedefs and tag constants
7. module constants
8. function prototypes
9. class method functions, borrowed-interface shims, and function definitions

Generated helper names are deterministic and derived from TypeC type structure or
namespace-qualified names. Namespace separators and unsupported C identifier characters are
rewritten to `_`. TypeC value names imported through namespace imports emit as qualified TypeC names
such as `Math.add` and C names such as `Math_add`.

When a TypeC source name has an explicit C name from header import or ABI metadata, that C name is
preserved. Otherwise generated names are stable for the same checked program. Unsupported
static-only types are rejected before this ordering reaches C type emission.

## Modules and Namespaces

TypeC modules are compile-time only. Imports are resolved before checking and do not emit runtime
module objects, loaders, or namespace values.

Named imports keep the imported TypeC name unless aliased. Namespace imports rewrite selected
members to qualified TypeC names such as `Math.add` and deterministic C names such as `Math_add`.
Only referenced namespace members and their dependency closure are emitted. Re-exported declarations
are emitted as ordinary selected declarations; no live binding object is generated.

## Enums and Tagged Unions

Enums emit as fixed-width scalar aliases plus scoped constants for each member. TypeC enum member
names remain scoped in source and lower to deterministic C constant names.

Tagged unions emit as a struct containing an `i32` tag and a payload union. Each variant has a
stable integer tag constant. Payload variants store their payload in the generated payload union
field; empty variants store only the tag.

Variant constructors lower to compound literals containing the tag and payload field when present.
Switches over enum values or tagged-union `tag` fields lower to ordinary C `switch` statements.
Exhaustiveness is checked before emission unless a `default` case is present.

## Interfaces and Borrowed Interface Views

Interfaces used only as compile-time constraints emit no C values. A borrowed `Interface&` value
emits as a generated fat view containing a receiver pointer and one function pointer per interface
method.

```c
typedef struct Readable {
  void* self;
  i32 (*get)(void*);
} Readable;
```

Borrowing a class value as an interface emits a compound literal with the receiver address and
class/interface shim functions:

```c
(Readable){ .self = &box, .get = Box_as_Readable_get }
```

A shim casts `self` back to the concrete class pointer and calls the statically named class method.
Borrowed interface calls dispatch through the view's function pointer:

```c
readable.get(readable.self)
```

No heap allocation, boxing, ownership transfer, or per-object runtime metadata is emitted.

## Function Types and Callbacks

Function type aliases emit as C function pointer typedefs:

```ts
type Callback = (value: i32) => i32;
```

```c
typedef i32 (*Callback)(i32);
```

Function-typed parameters and locals emit deterministic C function pointer declarators. Passing a
compatible TypeC function symbol as a callback emits the function name directly. Calling a
function-typed local or parameter emits an ordinary indirect C call such as `callback(value)`.
Capturing arrow functions lower only when they have a contextual function type and no captures;
capturing closures and optional function types are rejected before C emission.

## Classes

Class fields emit as deterministic C structs. Inherited fields are flattened into the child struct
before child-declared fields.

```ts
class Entity {
  x: i32;
}
class Ship extends Entity {
  hp: i32;
}
```

emits a `Ship` layout containing `x` before `hp`. Class values contain only fields; no object header
or runtime class metadata is stored in each value.

Instance methods emit as C functions with an explicit receiver pointer:

```c
static i32 Ship_shifted(Ship* this, i32 dx);
```

Static methods emit as C functions without a receiver. Constructors emit value-returning functions
named `Class_new`, initialize a local `this` value with zero, assign fields, and return that value.

Method calls use deterministic generated names. Instance calls lower directly to static functions
such as `Ship_shifted(&value, ...)`; no dispatch table is emitted and no method pointer is stored in
class values.

Overrides replace the inherited method selected for the child class at compile time. `super`,
virtual dispatch, prototype lookup, heap allocation by `new`, and per-value runtime metadata are not
emitted.

## Records and Structs

Record type aliases emit deterministic C structs in TypeC field declaration order.

```ts
type Point = { x: i32; y: i32 };
```

emits a C typedef containing `x` before `y`. Plain TypeC `struct` declarations emit named C structs
with the same field order.

```ts
struct Size { width: i32; height: i32; }
```

emits `typedef struct Size { ... } Size;`.

Optional fields emit their optional value representation. Omitted optional literal fields emit an
empty optional initializer. Nested records emit nested struct fields and nested compound
initializers.

Record spread and rest lower to explicit field copies. No runtime object metadata, property table,
prototype, enumerability check, or dynamic lookup is emitted.

Readonly is a TypeC checker rule. It does not change C field layout.

## Arrays, Tuples, and Slices

### Fixed arrays

`Array<T, N>` and `T[N]` emit as C fixed arrays with `N` elements of the emitted element type.

```ts
const values: Array<i32, 3> = [1, 2, 3];
```

emits as a fixed C array initializer. Array indexing emits direct C indexing. TypeC 0.1 performs no
runtime bounds check for array indexes.

### Inferred arrays

`Array<T>` and local `T[]` infer an exact fixed length from a non-empty array literal where
accepted. The emitted C declaration is still a fixed array with that inferred length.

### Array fill

`Array.fill(value)` in an expected fixed-array context emits a complete C initializer with one value
per element. `Array.fill((i) => expr)` emits a complete initializer by evaluating the callback at
compile time for each `usize` index.

### Tuples

Tuple types emit as generated structs with one field per tuple position. Tuple literals emit struct
initializers. Tuple indexing emits field access for the constant tuple index. Dynamic tuple indexes
are rejected before emission.

### Destructuring

Array and tuple destructuring emit independent local declarations initialized from the source
positions. Destructuring more bindings than available elements is rejected before emission.

### Slice helpers

`values.slice(start, end)` emits a `Slice<T>` compound value whose data pointer is offset by `start`
and whose length is `end - start`. Static out-of-bounds helper calls are rejected before emission.

## Memory Layout

### Raw pointers

`Ptr<T>` and `T*` emit as C pointers to the emitted representation of `T`.

```ts
const pointer: Ptr<i32> = value.&;
```

emits as an address expression over existing storage. TypeC does not synthesize ownership or
lifetime tracking for raw pointers.

### References

`Ref<T>` and `T&` emit as pointer-compatible C values. A reference must target existing storage and
cannot target `void`. References are non-owning. The compiler checks that reference types are valid
and that `value.&` is applied to an addressable expression.

### Safe pointers

`SafePtr<T>` emits as a pointer-compatible C value. It is non-null by accepted construction:

- `value.&` over addressable storage
- `arenaAlloc(arena, count)` in an expected `SafePtr<T>` context

Implicit raw-pointer-to-safe-pointer assignment is rejected before emission.

### Dereference

`value.*` emits as unary C dereference for pointer-like source types. Dereferencing non-pointer-like
values is rejected by the checker.

### Slices

`Slice<T>` emits as a generated record containing data and length fields:

```c
typedef struct Slice_i32 {
  i32* data;
  usize length;
} Slice_i32;
```

Arrays can be passed to or assigned into `Slice<T>` where element types match. Slice indexing emits
through the `data` field. Slice `.length()` emits the stored `length` value.

### Arenas

`Arena` emits as an opaque `__typec_arena*`. The built-ins lower as follows:

- `arenaCreate()` -> `__typec_arena_create()`
- `arenaDestroy(arena)` -> `__typec_arena_destroy(arena)`
- `arenaAlloc(arena, count)` -> `__typec_arena_alloc(arena, sizeof(T) * count)` in an expected
  `SafePtr<T>` context

Arena allocations are region-owned. Individual frees are not emitted. The compiler checks builtin
arity, arena argument type, allocation count type, and the required `SafePtr<T>` target context.
Destroying an arena while derived pointers remain usable is caller responsibility in TypeC 0.1.
