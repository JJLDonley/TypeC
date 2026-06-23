# TypeC Language Prototype

TypeC uses `.tc` files and TypeScript-like syntax, but compiles ahead-of-time to C.

## Current prototype subset

- Function declarations
- Required parameter and return type annotations
- Primitive types: `bool`, `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `usize`, `f32`,
  `f64`, `void`
- Module-level compile-time `const` declarations, local `const` statements, `let`, `return expr;`,
  `return;`, function-call expression statements, `while`, TypeScript-like `switch`, `break`, and
  assignment statements
- Integer literals, float literals, identifiers, calls, `+ - * / %`, and comparisons
- Postfix pointer operators `expr.&` and `expr.*`
- Record type aliases, record literals, and field access
- Fixed arrays `T[N]` / `Array<T, N>`, inferred local arrays `T[]` / `Array<T>`, nested fixed
  arrays, `.data` array pointer access, `.length()` fixed-array length access, pointer-decayed
  parameter arrays, array literals, and indexing
- Canonical pointer/reference types `Ptr<T>` and `Ref<T>` with equivalent compact `T*` and `T&`
  spellings
- NUL-terminated C string literals as `u8[]`, decaying to `Ptr<u8>`, `u8*`, `u8[]`, `u8[N]`, or
  `void*` for C calls
- `void*` C interop parameters accepting pointer and array arguments without pointee type
  information
- TypeScript-like scoped enums with fixed `i32` backing representation
- Static imports, standard-library imports, and explicit exports
- Explicit C extern function declarations and generated C header imports
- `//` and `/* */` comments

## Example

```ts
export function add(a: i32, b: i32): i32 {
  return a + b;
}

function main(): i32 {
  const x: i32 = add(20, 22);
  return x;
}
```

## Imports

Relative project imports use `./` or `../` paths:

```ts
import { add } from "./math.tc";
```

Namespace imports are planned for TypeC modules and C header modules:

```ts
import * as RL from "raylib";

function main(): i32 {
  RL.InitWindow(800, 450, "TypeC");
  RL.CloseWindow();
  return 0;
}
```

The namespace is a TypeC name-checking boundary. For C headers, emitted C uses the original C symbol
name.

Standard-library imports use `std/` paths:

```ts
import { abs_i32 } from "std/math.tc";
```

`project.json` can define dependency aliases and compiler flags:

```json
{
  "dependencies": {
    "basic/math": "std/math.tc",
    "raylib": "vendor/raylib.h"
  },
  "compiler": {
    "flags": ["-O2"]
  }
}
```

Dependency aliases are extensionless virtual import paths. They cannot be empty, contain empty,
encoded separator, encoded backslash, or `.` path segments, use backslashes, be relative paths,
absolute paths, URL-like paths, `std/` paths, file paths, or contain `..` segments.

Imports may target relative `.tc` files or relative `.h` headers and must use `/` separators without
malformed percent encoding, encoded separators, or encoded dot segments. Dependency targets may be
`std/` modules, absolute `.tc` or `.h` paths, or project-relative `.tc` or `.h` paths. Dependency
targets must use `/` separators and cannot contain encoded separators. Header targets are read
through clang AST output and exposed as explicit extern declarations. Project `-I`, `-isystem`,
`-D`, and `-U` flags are used while reading headers; relative `-I` and `-isystem` paths are resolved
from the project directory. `std/` targets cannot contain `..` segments. Project-relative dependency
targets cannot escape the project with `..` segments.

Compiler flags are appended to the native C compiler invocation. Entries must be flags, not extra
source files. Flags cannot override TypeC-controlled build behavior such as the C standard, output
path, input language, program entrypoint, hosted C environment, target environment, forced source
includes, or artifact mode. Flags that need operands must use single-argument form such as
`-Iinclude` or `-DNAME=VALUE`.

```json
{
  "compiler": {
    "flags": ["-O2", "-Wall"]
  }
}
```

Then source can import through the alias:

```ts
import { abs_i32 } from "basic/math";
```

## Standard Library

The standard library is written in TypeC and is expected to use the full completed language, not
only the initial core subset.

Current stdlib modules are simple because many advanced features are not implemented yet. Completed
features such as compile-time constants and switch statements may be used in stdlib modules where
they improve clarity, safety, or reuse. Essential later features such as enums, classes, methods,
interfaces, and generics should be adopted after their phases are implemented. Optional systems
features such as defer, safe pointers, arenas, and tagged unions should be adopted only when
explicitly prioritized.

## Constants and Planned Enums

Module-level constants use TypeScript-like syntax with explicit type annotations:

```ts
const SCREEN_WIDTH: i32 = 800;
export const SCREEN_HEIGHT: i32 = SCREEN_WIDTH + 50;
export const RAYWHITE: Color = { r: 245, g: 245, b: 245, a: 255 };
```

Constants are compile-time values. Initializers may use literals, earlier constants, record
literals, array literals, unary `+` / `-`, and numeric `+ - * / %`. Calls, pointer operators,
indexing, and runtime locals are not compile-time constant expressions. Integer and `f32`
expressions are checked against the annotated type, including inside record and array constants.
Integer constant division and modulo by zero are rejected. Exported constants are visible to TypeC
imports but are not exported as C ABI symbols. `extern const` is invalid TypeC source syntax; C
header constants are imported through header modules instead.

Runnable example:

```bash
deno run -A src/driver/main.ts run examples/constants.tc
```

## Switch Statements

Switch statements use TypeScript-like `switch`, `case`, `default`, and `break` syntax. Fallthrough
follows TypeScript/C semantics unless a case exits with `break;`, `return`, or another explicit
exit. Case labels must be compile-time constants assignable to the switch expression type. Duplicate
case values are invalid. `default` is optional and may appear at most once.

```ts
function classify(value: i32): i32 {
  switch (value) {
    case 0:
    case 1:
      return 42;
    default:
      return 0;
  }
}
```

Runnable example:

```bash
deno run -A src/driver/main.ts run examples/switch.tc
```

## Enums

TypeC supports TypeScript-like scoped enums with default `i32` backing representation:

```ts
export enum Key {
  Space = 32,
  Escape = 256,
}

const key: Key = Key.Space;
```

Enum members are scoped and have the enum type, not raw `i32`. Raw integers are not implicitly
assignable to enum types, and enum values are not implicitly assignable to integer types. Duplicate
member names are invalid. Duplicate member values are allowed. Named C header enums import as scoped
namespace enum types when all member values are deterministic `i32` values.

Runnable example:

```bash
deno run -A src/driver/main.ts run examples/enum.tc
```

## Array, Slice, Pointer, and Reference Model

The current prototype supports `T*`, `T&`, local `T[]`, `T[N]`, and canonical spellings `Ptr<T>`,
`Ref<T>`, `Array<T>`, `Array<T, N>`, and `Slice<T>`. `Slice<T>` is supported for TypeC-owned APIs
and lowers to a generated C struct with `data` and `length` fields.

```txt
Ptr<T>        // raw pointer, no length
Ref<T>        // reference
Array<T>      // inferred-size array value
Array<T, N>   // fixed-size array value
Slice<T>      // pointer plus runtime length
```

Compact syntax remains equivalent where specified:

```ts
T*    // Ptr<T>
T&    // Ref<T>
T[]   // Array<T> for local inferred arrays; C ABI pointer-decayed array in parameters
T[N]  // Array<T, N>
```

`T[]` is not slice syntax. Slices are spelled `Slice<T>`. Arrays may decay to `Ptr<T>` only when a
raw pointer or C ABI parameter is expected. Array `.data` exposes the raw pointer for C interop.
Fixed arrays expose `.length()` as a compile-time `usize`; unsized C ABI array parameters do not
carry length. Fully sized nested C arrays are supported for header record fields and pointer-decayed
parameters. `Array<T, N>` coerces to `Slice<T>` where a TypeC-owned slice is expected.

Runnable canonical type examples:

```bash
deno run -A src/driver/main.ts run examples/pointer_canonical.tc
deno run -A src/driver/main.ts run examples/ref_canonical.tc
deno run -A src/driver/main.ts run examples/array_canonical.tc
deno run -A src/driver/main.ts run examples/array_fixed_canonical.tc
deno run -A src/driver/main.ts run examples/slice_canonical.tc
```

Array and slice members:

```txt
array.length()
array.data
slice.length()
slice.data
```

## Header Interop

Header dependencies are usable without a hand-written ABI file:

```json
{
  "dependencies": {
    "raylib": "vendor/raylib.h"
  },
  "compiler": {
    "flags": ["-Ivendor/raylib/include", "-Lvendor/raylib/lib", "-lraylib"]
  }
}
```

```ts
import * as RL from "raylib";

function main(): i32 {
  RL.InitWindow(800, 450, "TypeC");
  RL.CloseWindow();
  return 0;
}
```

Named imports from the same project dependency are also supported:

```ts
import { Color } from "raylib";
```

Header imports are virtual TypeC modules generated from clang AST output. Supported functions,
pointers, arrays, typedef structs, and bare struct records are imported when they can be represented
safely. C `bool` and `_Bool` import as TypeC `bool`, which emits as `b8`.

Current header interop supports fully sized nested C arrays, function pointer type imports using
TypeScript-like `(arg: T) => R`, callback parameters passed compatible function symbols, variadic
extern declarations using `...args`, deterministic `const` variables, and safe object-like macro
constants. Header constants import through normal named or namespace imports. Supported macro values
are limited to simple numeric, bool, and unescaped string object-like macros. Named C enums import
as scoped namespace enum types when their values are deterministic and fit in `i32`. Function-like
macros, old-style declarations, array returns, unsafe macros, complex runtime constants, and unknown
signatures remain skipped unless a later phase defines safe lowering.

Runnable examples:

```bash
deno run -A src/driver/main.ts run examples/c_header_record.tc
deno run -A src/driver/main.ts run examples/c_header_namespace.tc
deno run -A src/driver/main.ts run examples/c_header_project/main.tc
```

C header mapping goals:

```txt
char*                 -> Ptr<u8> / u8*
const char*           -> Ptr<u8> / u8*
uint8_t*              -> Ptr<u8> / u8*
T*                    -> Ptr<T> / T*
T[N] parameter        -> Ptr<T> / T[] ABI parameter
T[N] record field     -> Array<T, N> / T[N]
fixed-width scalars   -> i8/u8/i16/u16/i32/u32/i64/u64/f32/f64
platform C scalars    -> explicit ABI aliases when required
R (*)(T) parameter    -> (arg: T) => R callback parameter
variadic ...          -> ...args rest parameter
const variables       -> module constants when deterministic
object-like macros    -> module constants when safely representable
```

## C Interop

String literals are byte strings with a trailing NUL byte. They can initialize `u8[]` / `Array<u8>`
locals and pass to C functions expecting `u8*`, `Ptr<u8>`, `u8[]`, `u8[N]`, or `void*`.

```ts
extern function puts(text: Ptr<u8>): i32;

function main(): i32 {
  const text: Array<u8> = "hello";
  puts(text);
  return 0;
}
```

Runnable examples:

```bash
deno run -A src/driver/main.ts run examples/c_string.tc
deno run -A src/driver/main.ts run examples/c_string_canonical.tc
```

Raw `void*` parameters accept C-compatible pointer and array arguments without length or pointee
type information. C `char*` and `const char*` map to `Ptr<u8>` with `u8*` retained as equivalent
compact syntax.

```ts
extern function memset(data: Ptr<void>, value: i32, count: usize): Ptr<void>;

function main(): i32 {
  const bytes: Array<u8> = [0, 0, 0];
  memset(bytes, 42, 3);
  return 42;
}
```

Runnable examples:

```bash
deno run -A src/driver/main.ts run examples/c_void_pointer.tc
deno run -A src/driver/main.ts run examples/c_void_pointer_canonical.tc
```

## Run

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
