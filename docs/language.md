# TypeC Language Prototype

TypeC uses `.tc` files and TypeScript-like syntax, but compiles ahead-of-time to C.

## Current prototype subset

- Function declarations
- Required parameter and return type annotations
- Primitive types: `bool`, `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `usize`, `f32`,
  `f64`, `void`
- `return expr;`, `return;`, function-call expression statements, `while`, assignment, `let`, and
  `const` statements
- Integer literals, float literals, identifiers, calls, `+ - * / %`, and comparisons
- Postfix pointer operators `expr.&` and `expr.*`
- Record type aliases, record literals, and field access
- Fixed arrays `T[N]`, inferred local arrays `T[]`, pointer-decayed parameter arrays, array
  literals, and indexing
- NUL-terminated C string literals as `u8[]`, decaying to `u8*`, `u8[]`, `u8[N]`, or `void*` for C
  calls
- `void*` C interop parameters accepting pointer and array arguments without pointee type
  information
- Static imports, standard-library imports, and explicit exports
- Explicit C extern function declarations
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

Current stdlib modules are simple because advanced features are not implemented yet. As features
such as classes, methods, enums, generics, interfaces, tagged unions, pattern matching, safe
pointers, defer, arenas, and compile-time constants are completed, stdlib APIs should be updated to
use them where they improve clarity, safety, or reuse.

## Planned Array, Slice, Pointer, and Reference Model

The current prototype supports `T*`, `T&`, local `T[]`, and `T[N]`. The planned canonical model is:

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

`T[]` is not slice syntax. Slices are spelled `Slice<T>`. Arrays automatically coerce to `Slice<T>`
when a slice is expected. Arrays may decay to `Ptr<T>` only when a raw pointer or C ABI parameter is
expected.

Planned array and slice members:

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

Header imports are virtual TypeC modules generated from clang AST output. Supported functions,
pointers, arrays, typedef structs, and bare struct records are imported when they can be represented
safely. Unsupported function pointers, callbacks, variadics, old-style declarations, array returns,
unsafe macros, enums, constants, and unknown signatures are skipped until specified.

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
```

## C Interop

String literals are byte strings with a trailing NUL byte. They can initialize `u8[]` locals and
pass to C functions expecting `u8*`, `u8[]`, `u8[N]`, or `void*`.

```ts
extern function puts(text: u8*): i32;

function main(): i32 {
  const text: u8[] = "hello";
  puts(text);
  return 0;
}
```

Raw `void*` parameters accept C-compatible pointer and array arguments without length or pointee
type information. In the planned canonical model, C `char*` and `const char*` map to `Ptr<u8>` with
`u8*` retained as equivalent compact syntax.

```ts
extern function memset(data: void*, value: i32, count: usize): void*;

function main(): i32 {
  const bytes: u8[] = [0, 0, 0];
  memset(bytes, 42, 3);
  return 42;
}
```

## Run

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
