# TypeC Phase Document

TypeC is a low-level, strictly typed language using TypeScript-like syntax and compiling
ahead-of-time to C.

Source files use the `.tc` extension.

```txt
example.tc -> TypeC compiler -> C -> native binary
```

TypeC is not JavaScript. TypeC is not TypeScript with a runtime. TypeC borrows TypeScript syntax
where useful, but its semantics are static, predictable, and suitable for systems programming.

---

## Core Goal

Build a small, strict, native language that feels familiar to TypeScript users but behaves like a
low-level compiled language.

TypeC should provide:

- predictable native performance
- strict static typing
- no garbage collector
- explicit memory behavior
- C interoperability
- simple compiler architecture
- fast prototyping using Deno + TypeScript

---

## File Extension

All TypeC source files use:

```txt
.tc
```

Example:

```txt
main.tc
math.tc
buffer.tc
```

---

## Compiler Pipeline

```txt
.tc source
  ↓
Lexer
  ↓
CAST  Concrete AST
  ↓
AST   Normalized AST
  ↓
RAST  Resolved AST
  ↓
TAST  Typed AST
  ↓
C Emitter
  ↓
C Compiler
  ↓
Native executable
```

Optional later phase:

```txt
TAST
  ↓
MIR / IR
  ↓
C Emitter / LLVM / other backend
```

---

# Phase 0: Language Definition

## Goal

Define the exact TypeC subset before building too much compiler complexity.

## Deliverables

- `docs/language.md`
- list of keywords
- primitive type list
- expression grammar
- statement grammar
- module/import rules
- memory model notes
- examples in `examples/*.tc`

## Syntax Style Policy

TypeC should look like TypeScript whenever TypeScript has a clear equivalent syntax. Use
TypeScript-like syntax for functions, variables, blocks, control flow, classes, methods, interfaces,
generics, enums, and imports.

When TypeScript has no suitable systems-language equivalent, prefer modern systems syntax inspired
by Zig before inventing new syntax. This applies to explicit memory, arenas, pointer safety modes,
and other low-level features that TypeScript does not model.

## Initial Syntax Style

TypeC should look like TypeScript:

```ts
function add(a: i32, b: i32): i32 {
  return a + b;
}

function main(): i32 {
  const x: i32 = add(20, 22);
  return x;
}
```

## Do

- Use TypeScript-like syntax.
- Use `.tc` source files.
- Require clear static types.
- Make every valid program compile predictably to C.
- Prefer a small, well-defined language over broad TS compatibility.

## Do Not

- Do not implement JavaScript semantics.
- Do not support `any`.
- Do not support dynamic property creation.
- Do not support prototype inheritance.
- Do not depend on a JS runtime.
- Do not try to compile arbitrary `.ts` files.

---

# Phase 1: Lexer

## Goal

Convert `.tc` source text into tokens.

## Deliverables

- lexer module
- token type definitions
- token location tracking
- lexer diagnostics
- lexer tests

## Token Categories

- identifiers
- keywords
- integer literals
- float literals
- string literals for NUL-terminated `u8[]` C strings
- operators
- punctuation
- comments
- EOF

Pointer, reference, slice, and array syntax requires these tokens to be preserved distinctly enough
for parsing:

```txt
[ ]
*
&
.
.*
.&
```

`.*` and `.&` are postfix expression operators, not prefix operators.

## Required Keywords, Initial

```txt
function
return
let
const
if
else
while
true
false
type
import
export
```

## Primitive Types, Initial

```txt
bool
i8 i16 i32 i64
u8 u16 u32 u64
f32 f64
void
```

## Do

- Track line and column for every token.
- Preserve enough source-span data for useful errors.
- Keep lexer independent from parser logic.
- Support `//` and `/* */` comments.

## Do Not

- Do not infer meaning in the lexer.
- Do not parse expressions in the lexer.
- Do not discard source locations.

---

# Phase 2: Parser and CAST

## Goal

Parse tokens into a Concrete AST that accurately represents source syntax.

## Deliverables

- parser module
- CAST node definitions
- parser diagnostics
- parser tests

## Initial Supported Syntax

```ts
function main(): i32 {
  return 0;
}
```

Then expand to:

```ts
const x: i32 = 1;
let y: i32 = x + 2;
call_side_effect();
```

Then add low-level type syntax:

```ts
let pointer: Ptr<i32> = value.&;
let pointerSugar: i32* = value.&;
let reference: Ref<i32> = value.&;
let referenceSugar: i32& = value.&;
let inferredArray: Array<i32> = values;
let inferredArraySugar: i32[] = values;
let fixedArray: Array<i32, 16> = values;
let fixedArraySugar: i32[16] = values;
```

Parser rules:

- `Ptr<T>` is the canonical raw pointer type. `T*` is equivalent syntax.
- `Ref<T>` is the canonical reference type. `T&` is equivalent syntax.
- `Array<T, N>` is the canonical fixed-size array value type with compile-time length `N`. `T[N]` is
  equivalent syntax.
- `Array<T>` is an inferred-size array value type and is valid only where an initializer supplies
  the length. `T[]` is equivalent local array syntax.
- `Slice<T>` is a length-carrying view over contiguous `T` values. It has pointer data and runtime
  length.
- `T[]` is never slice syntax. Slice syntax is `Slice<T>` only.
- Dereference is an expression operation (`expr.*`), not a type wrapper. Do not introduce `Deref<T>`
  in this phase.
- In function parameter and C ABI positions, legacy `T[]` remains pointer-decayed C array syntax for
  C interop only.
- Pointer/reference operators are postfix only.
- `expr.*` means dereference pointer expression.
- `expr.&` means address/reference expression.
- Prefix `*expr` and prefix `&expr` are not valid TypeC.

## Do

- Preserve syntax structure.
- Keep CAST close to the written source.
- Produce good parse errors.
- Recover from simple parse errors where possible.

## Do Not

- Do not perform type checking in the parser.
- Do not resolve names in the parser.
- Do not lower syntax too aggressively in CAST.

---

# Phase 3: AST Normalization

## Goal

Convert CAST into a cleaner AST used by later compiler stages.

## Deliverables

- AST node definitions
- CAST-to-AST lowering
- AST printer/debug output

## Examples of Normalization

- remove redundant punctuation nodes
- normalize function declarations
- normalize block statements
- normalize type annotations
- normalize object/type literal structure

## Do

- Make AST easy for resolver and checker to consume.
- Preserve source spans for diagnostics.
- Separate syntax shape from semantic meaning.

## Do Not

- Do not erase user-written names.
- Do not erase spans.
- Do not perform final type decisions here.

---

# Phase 4: Name Resolution and RAST

## Goal

Resolve identifiers into symbols and scopes.

RAST means Resolved AST.

## Deliverables

- symbol table
- scope tree
- module resolver
- RAST node definitions
- duplicate-name diagnostics
- unknown-name diagnostics

## Supported Items

- functions
- local variables
- parameters
- type aliases
- imported symbols, later

## Do

- Resolve every identifier to a symbol.
- Detect undefined names.
- Detect duplicate declarations.
- Separate global, function, and block scopes.

## Do Not

- Do not allow implicit globals.
- Do not allow use-before-declare for locals unless explicitly designed.
- Do not guess missing names.

---

# Phase 5: Type Checking and TAST

## Goal

Validate types and produce a Typed AST.

TAST means Typed AST.

## Deliverables

- type representation
- type checker
- TAST node definitions
- assignment checking
- return checking
- bare `return;` for `void` functions
- function call checking
- function-call expression statement checking
- binary operator checking
- pointer/reference checking
- slice/array checking
- typed diagnostics

## Initial Type Rules

```ts
function add(a: i32, b: i32): i32 {
  return a + b;
}
```

Rules:

- function parameters require types
- function return types require annotations initially
- local variables may infer from initializer
- no implicit `any`
- no implicit nullable values
- no implicit numeric widening unless explicitly allowed
- `Ptr<T>`, `Ref<T>`, `Array<T>`, `Array<T, N>`, and `Slice<T>` are distinct static types; `T*`,
  `T&`, local `T[]`, and `T[N]` normalize to their canonical forms; parameter/C ABI `T[]` lowers to
  `T*` / `Ptr<T>`
- `expr.*` requires pointer-like input and produces the pointee type
- `expr.&` produces pointer/reference type according to context
- prefix pointer operators are rejected

## Do

- Make every expression have a known type.
- Reject ambiguous code.
- Prefer explicit casts over implicit conversions.
- Keep type rules simple at first.

## Do Not

- Do not implement TypeScript's full structural type system immediately.
- Do not allow `any`.
- Do not allow implicit `undefined`.
- Do not allow implicit `null`.
- Do not allow runtime type reflection as a core feature.

---

# Phase 6: C Emitter

## Goal

Emit readable C from TAST.

## Deliverables

- C emitter
- C type mapper
- generated header/body strategy
- compile command driver
- golden output tests

## Example

Input `main.tc`:

```ts
function main(): i32 {
  const x: i32 = 40 + 2;
  return x;
}
```

Output C:

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef int32_t i32;

i32 main(void) {
  const i32 x = 40 + 2;
  return x;
}
```

## Do

- Emit simple readable C.
- Include required C headers.
- Use TypeC fixed-width typedef names (`i32`, `usize`, `b8`, etc.) backed by standard C headers.
- Generate deterministic output.
- Keep emitter dependent on TAST, not raw AST.

## Do Not

- Do not emit C from untyped AST.
- Do not emit JavaScript.
- Do not require a runtime unless a feature truly needs one.
- Do not hide memory behavior in generated code.

---

# Phase 7: Compiler Driver and Auto Compile

## Goal

Provide a CLI that builds and watches `.tc` files.

## Deliverables

- `typec build file.tc`
- `typec run file.tc`
- `typec watch file.tc`
- diagnostics formatting
- build directory output

## Suggested Commands

```bash
deno run -A src/driver/main.ts build examples/main.tc
deno run -A src/driver/main.ts run examples/main.tc
deno run -A src/driver/main.ts watch examples/main.tc
```

Later:

```bash
typec build examples/main.tc
typec run examples/main.tc
typec watch examples/main.tc
```

## Auto Compile Behavior

Watch mode should:

1. watch `.tc` files
2. re-run compiler on change
3. emit C
4. invoke C compiler
5. optionally run resulting binary
6. print diagnostics clearly

## Do

- Make the compiler fast to run.
- Make errors readable.
- Rebuild automatically during development.
- Keep generated files in a build directory.

## Do Not

- Do not mix source files and generated files.
- Do not overwrite user C files accidentally.
- Do not continue after fatal compiler errors.

---

# Phase 8: Records / Object Types

## Goal

Support TypeScript-style object types as C structs.

## Example

```ts
type Vec2 = {
  x: f32;
  y: f32;
};

function add(a: Vec2, b: Vec2): Vec2 {
  return {
    x: a.x + b.x,
    y: a.y + b.y,
  };
}
```

## C Output Concept

```c
typedef struct {
  f32 x;
  f32 y;
} Vec2;
```

## Do

- Keep object layout static.
- Require known fields at compile time.
- Reject missing fields.
- Reject unknown fields.
- Preserve declaration order for predictable layout.

## Do Not

- Do not support dynamic object maps by default.
- Do not allow adding fields after creation.
- Do not implement JS property lookup.
- Do not implement prototypes.

---

# Phase 9: Arrays, Pointers, and Memory

## Goal

Introduce low-level memory features without a garbage collector.

## Type Syntax

TypeC has canonical explicit low-level container and pointer types:

```txt
Ptr<T>        // raw pointer to T, no length
Ref<T>        // reference to T
Array<T>      // inferred-size array value; initializer must provide length
Array<T, N>   // fixed-size array value with compile-time length N
Slice<T>      // pointer plus runtime length view over contiguous T values
```

TypeC also keeps compact C-adjacent sugar for raw pointer, reference, and array values:

```ts
T*          // equivalent to Ptr<T>
T&          // equivalent to Ref<T>
T[]         // equivalent to Array<T> for local inferred arrays; C ABI pointer-decayed array in parameter positions
T[N]        // equivalent to Array<T, N>
```

`T[]` is never a length-carrying slice. Slices are spelled `Slice<T>` only. Dereference remains an
expression operation (`expr.*`), not a wrapper type; no `Deref<T>` type is introduced in this phase.

Examples:

```ts
function load(p: i32*): i32 {
  return p.*;
}

function byRef(v: i32&): i32 {
  return v;
}

function sum(values: Slice<i32>): i32 {
  let total: i32 = 0;
  let i: usize = 0;

  while (i < values.length()) {
    total = total + values[i];
    i = i + 1;
  }

  return total;
}

function first(values: Array<i32, 16>): i32 {
  return values[0];
}

function localArray(): i32 {
  const values: Array<i32> = [1, 2, 3];
  return values[0];
}

function sliceFromArray(): i32 {
  const values: Array<i32> = [1, 2, 3];
  return sum(values);
}
```

## Array and Slice Behavior

Array values own fixed storage. Slice values are views containing `data: Ptr<T>` and
`length: usize`.

```txt
array.length()    // compile-time array length as usize
array.data        // pointer to the first element, Ptr<T>
slice.length()    // runtime slice length as usize
slice.data        // slice data pointer, Ptr<T>
```

`Array<T, N>` coerces to `Slice<T>` when a slice is expected.

```ts
function take(values: Slice<i32>): i32 {
  return values.length();
}

function main(): i32 {
  const values: Array<i32> = [1, 2, 3];
  return take(values);
}
```

An `Array<T, N>` may decay to `Ptr<T>` only when a raw pointer or C ABI parameter is expected. C
APIs that need length should pass an explicit `usize`; TypeC-owned APIs can use `Slice<T>`.

## Pointer and Reference Operators

Pointer/reference expression operators are postfix only:

```ts
value.&   // address/reference expression
ptr.*     // dereference pointer expression
```

Prefix pointer syntax is intentionally invalid:

```ts
*p        // invalid
&value    // invalid
```

Rationale:

- postfix operators compose naturally with TypeScript-style member/index syntax
- no ambiguity with binary `*` and `&`
- no C-style declaration confusion
- keeps pointer operations visually attached to the value being operated on

## Do

- Make allocation explicit.
- Make ownership rules documented.
- Make pointer/slice behavior clear.
- Prefer safe defaults where possible.
- Use `Array<T>`, `Array<T, N>`, `Slice<T>`, `Ptr<T>`, and `Ref<T>` as canonical low-level types.
- Keep `T[]`, `T[N]`, `T*`, and `T&` as equivalent compact syntax where specified.
- Lower C ABI array declarations as pointers (`T[]` -> `T*` / `Ptr<T>`).
- Use postfix `expr.*` and `expr.&` for pointer/reference expressions.
- Reject prefix `*expr` and `&expr`.

## Do Not

- Do not add a garbage collector.
- Do not hide heap allocation behind normal object literals.
- Do not make arrays secretly dynamic JS arrays.
- Do not treat raw C ABI `T[]` as a safe slice; it carries no length after pointer decay.
- Do not add alternate lowercase wrapper spellings such as `ptr<T>`, `slice<T>`, or `array<T, N>`.
- Do not support prefix pointer operators.
- Do not allow unchecked pointer behavior in safe code without a clear escape hatch.

---

# Phase 10: Modules

## Goal

Support multi-file TypeC projects and standard-library imports.

## Example

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

```ts
import { add } from "./math.tc";
import { abs_i32 } from "std/math.tc";
import { max_i32 } from "basic/math";
import * as RL from "raylib";

function main(): i32 {
  RL.InitWindow(800, 450, "TypeC");
  RL.CloseWindow();
  return add(abs_i32(1), max_i32(1, 2));
}
```

## `project.json`

`project.json` is optional. When present, it is searched from the input file directory upward.

Supported fields:

- `dependencies`: maps import aliases to `.tc` files.
- `compiler.flags`: extra native C compiler flags.

Dependency aliases are extensionless virtual import paths. They cannot be empty, contain empty,
encoded separator, encoded backslash, or `.` path segments, use backslashes, be relative paths,
absolute paths, URL-like paths, `std/` paths, file paths, or contain `..` segments.

Imports may target relative `.tc` files or relative `.h` headers and must use `/` separators without
malformed percent encoding, encoded separators, or encoded dot segments. Dependency targets may be
relative project paths, absolute paths, or `std/` paths. Dependency targets must use `/` separators
and cannot contain encoded separators. TypeC dependency targets use `.tc`; C header dependency
targets use `.h` and are converted to explicit extern declarations through compiler AST output.
Project `-I`, `-isystem`, `-D`, and `-U` flags are used while reading headers; relative `-I` and
`-isystem` paths are resolved from the project directory. `std/` targets cannot contain `..`
segments. Project-relative dependency targets cannot escape the project with `..` segments.

Namespace imports are planned for both TypeC and C header modules:

```ts
import * as Math from "basic/math";
import * as RL from "raylib";
```

A namespace import binds the imported module under the chosen namespace. For C headers, the
namespace is TypeC-only; emitted C calls use the original C symbol name unless a later ABI rule
specifies mangling.

```ts
import * as RL from "raylib";

function main(): i32 {
  RL.InitWindow(800, 450, "TypeC");
  RL.CloseWindow();
  return 0;
}
```

Compiler flag entries must be flags, not extra source files. They cannot override TypeC-controlled
build behavior such as the C standard, output path, input language, program entrypoint, hosted C
environment, target environment, forced source includes, or artifact mode. Flags that need operands
must use single-argument form.

## Standard Library Policy

The standard library is normal TypeC code. It should use the strongest completed language features
available.

Early stdlib modules may start with the current core subset only because later features do not exist
yet. As enums, classes, methods, interfaces, generics, and compile-time constants become available,
stdlib modules should be refactored to use those features where they make APIs clearer, safer, or
more reusable. Optional systems features such as defer, safe pointers, arenas, and tagged unions
should be adopted only when they are explicitly prioritized.

Feature phases must include stdlib impact checks:

- Add or update stdlib examples when the feature is useful for basic library APIs.
- Prefer generic stdlib APIs over duplicated primitive-only APIs once generics are implemented.
- Prefer enums/tagged unions over integer sentinel values once those features are implemented.
- Prefer safe pointer abstractions and arenas in stdlib memory APIs once specified.
- Keep emitted C portable and explicit.

## Do

- Resolve imports statically.
- Compile modules deterministically.
- Detect import cycles.
- Support explicit exports.
- Support `std/` imports from the checked-in TypeC standard library.
- Support `project.json` dependency aliases and compiler flags.
- Support `project.json` aliases to C headers for generated extern declarations.
- Support namespace imports (`import * as Name from "module"`) after they are implemented.
- Treat stdlib modules as first-class TypeC modules that may use any completed language feature.

## Do Not

- Do not mimic Node module resolution fully.
- Do not require JavaScript package semantics.
- Do not make import behavior depend on runtime loading.
- Do not import host JavaScript modules as TypeC modules.
- Do not execute project configuration as code.
- Do not freeze stdlib design to the initial compiler subset.

---

# Phase 11: Interop with C

## Goal

Allow TypeC to call C and expose C-compatible functions.

## Syntax

```ts
extern function puts(s: Ptr<u8>): i32;
extern function read_bytes(dst: u8[], count: usize): usize;

export function main(): i32 {
  return 0;
}
```

C string literals use ordinary string token syntax and have TypeC type `Array<u8, N>` with a
trailing NUL byte. They are valid where `Array<u8, N>`, legacy `u8[]`, `u8*`, `Ptr<u8>`, or a
C-compatible pointer-decayed argument is expected. `Slice<u8>` string-literal decay follows the
array-to-slice coercion rules.

```ts
extern function puts(s: Ptr<u8>): i32;

function main(): i32 {
  return puts("hello");
}
```

## C ABI Array and String Rules

- `Array<T>` / local `T[]` is an inferred-size static array.
- `Array<T, N>` / `T[N]` is a fixed-size static array.
- `Slice<T>` is a length-carrying `{ data: Ptr<T>, length: usize }` view and is not C ABI-compatible
  for external C declarations. TypeC-owned slice parameters and locals lower to generated C structs.
- `Array<T, N>` coerces to `Slice<T>` where a slice is expected.
- `Array<T, N>` may decay to `Ptr<T>` / `T*`, legacy C ABI `T[]`, or `void*` when a raw C ABI
  pointer is expected.
- Legacy `T[]` in function parameter position is an unsized C array parameter and lowers to `T*` /
  `Ptr<T>`.
- `T[N]` in function parameter position lowers as a C array parameter, which is ABI-equivalent to
  `T*`; the declared `N` is documentation/checking metadata, not passed at runtime.
- `u8*` / `Ptr<u8>` is the TypeC representation for C byte/string pointers. In C header interop,
  `char*`, `const char*`, and `unsigned char*` map to `u8*` / `Ptr<u8>`.
- C array forms map to legacy `u8[]` / `Array<u8>` when preserved by the header AST and to `u8*` /
  `Ptr<u8>` after ABI decay.
- TypeC string literals are NUL-terminated `Array<u8, N>` values and can decay to `u8*`, `Ptr<u8>`,
  legacy `u8[]`, `u8[N]`, `Array<u8, N>`, or `void*` where expected. `Slice<u8>` decay follows the
  array-to-slice coercion rules when a `Slice<u8>` is expected.
- Raw C ABI `T[]`/`T*`/`Ptr<T>` carries no length; C APIs needing length should pass an explicit
  `usize`. TypeC-owned APIs can use `Slice<T>`.
- Array and slice return types remain invalid for C ABI externs; return `T*` / `Ptr<T>` for
  pointer-return C APIs. C functions cannot return array values directly, and TypeC does not guess
  wrapper ABI rules.

## Canonical Array and Slice Implementation Order

1. Add builtin generic type parsing and normalization for `Array<T>`, `Array<T, N>`, `Slice<T>`,
   `Ptr<T>`, and `Ref<T>`.
2. Normalize existing sugar to canonical forms: `T[]` to `Array<T>` in local inferred-array
   positions, `T[N]` to `Array<T, N>`, `T*` to `Ptr<T>`, and `T&` to `Ref<T>`.
3. Add local type inference for array literals and string literals: `[1, 2, 3]` infers
   `Array<i32, 3>` and `"abc"` infers `Array<u8, 4>`.
4. Add array and slice member access: `.data` and `.length()`.
5. Add implicit `Array<T, N>` to `Slice<T>` coercion where a slice is expected.
6. Preserve `Array<T, N>` to `Ptr<T>` decay only where a raw pointer or C ABI parameter is expected.
7. Update C emission so array-to-slice calls pass generated slice values and array-to-pointer C
   calls pass array data.

## C Header Import Rules

Header imports are virtual TypeC modules generated from compiler AST output. They should let users
write direct interop without a hand-written ABI file:

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

- Header-generated declarations must come from compiler AST output.
- Header-generated modules can be imported by named imports or namespace imports.
- Namespace imports are TypeC-only. Header imports emit references to the imported C symbol name;
  TypeC namespace imports emit predictable C-safe internal names to avoid collisions.
- Emitted C function symbols, type symbols, and cross-kind ordinary identifiers must be unique,
  except repeated compatible declarations for the same imported C symbol.
- Supported C scalar types map to fixed-width TypeC names when the C type has fixed width.
- C `bool` and `_Bool` map to TypeC `bool`, which emits as C `b8`.
- Platform-width C scalar types map to explicit ABI aliases such as `c_int`, `c_uint`, `c_long`, and
  `c_ulong`; call sites emit those TypeC ABI aliases rather than raw C spellings.
- Pointer types map recursively to TypeC `T*` / `Ptr<T>`.
- C function pointer types map to TypeScript-like function types: `(arg: T) => R`. Function pointer
  values are raw C ABI pointers and cannot capture TypeC local state.
- C callback parameters accept only compatible external function symbols or non-capturing TypeC
  function declarations. Closures and captured locals are not part of the C ABI.
- `char*`, `const char*`, and `unsigned char*` map to `u8*` / `Ptr<u8>`.
- `void*` accepts C-compatible object pointer and array arguments; it carries no pointee type
  information.
- C array parameters map to legacy TypeC `T[]` or `T*` / `Ptr<T>` and lower to C pointers. Header
  declarations that differ only by array-vs-pointer parameter spelling are treated as the same ABI
  signature.
- Nested fixed C arrays map to nested canonical TypeC arrays when every dimension is known, e.g.
  `i32[2][3]` maps to `Array<Array<i32, 3>, 2>` and compact `i32[2][3]`. Nested unsized arrays,
  mixed unsized inner dimensions, and nested pointer-decayed arrays remain unsupported because their
  length information is not recoverable from C ABI spelling alone.
- C typedef structs and bare struct records with C-compatible fields import as TypeC record aliases;
  fixed-size C array fields import as fixed TypeC arrays such as `T[N]`; namespace imports expose
  records as qualified TypeC types such as `RL.Color` while emitted C uses the original C typedef
  name and preserves the C struct tag when needed.
- Header functions using records are generated only for records that were selected and supported;
  records depending on unsupported records are skipped safely.
- Header functions without source locations may be imported when their signature references a known
  selected record, including pointer, qualifier, `struct T`, and array spellings.
- Duplicate header records with equivalent mapped TypeC field layouts collapse to one imported
  record; fixed array field sizes are part of compatibility; duplicate incompatible header records
  are skipped safely.
- Imported header records are emitted before records that depend on them when dependency order can
  be resolved; unresolved recursive record cycles are skipped safely.
- C enums should import as namespaced integer-backed constants or enum types once enum semantics are
  specified.
- C constants and simple object-like macros should import only when they can be represented safely
  and deterministically.
- Variadic C functions use TypeScript-like rest syntax in extern declarations:

  ```ts
  extern function printf(format: Ptr<u8>, ...args): c_int;
  ```

  Variadic arguments must already match C default-promotion-compatible TypeC types: `i32`, `u32`,
  `i64`, `u64`, `usize`, `f64`, `c_int`, `c_uint`, `c_long`, `c_ulong`, `c_longlong`, `c_ulonglong`,
  `c_double`, raw pointers, or arrays that decay to raw pointers. Record values, slices, TypeC-only
  types, `bool`, narrow integer types, and `f32` are not valid variadic arguments.
- Function-like C macros are not imported as functions. They remain unsupported unless a later phase
  defines a typed inline expansion model. Object-like macros are handled only by Phase 12 constant
  import rules.
- Old-style declarations, unsupported macros, unsafe signatures, and signatures requiring
  unsupported callback, variadic, or function-pointer behavior are skipped safely.

## Header Interop Implementation Order

1. Add namespace import syntax and module resolution: `import * as RL from "raylib"`.
2. Resolve namespace-qualified function calls for existing TypeC and header-generated modules.
3. Preserve original C symbol names during emission while using TypeC namespaces only for checking.
4. Add C ABI alias types for platform-width C scalars and emit portable typedefs for them.
5. Add C typedef struct import for C-compatible fields, qualified namespace type references, and
   namespaced field access.
6. Add nested fixed-array record field and parameter import for fully sized nested arrays.
7. Add C function pointer type import using TypeScript-like function type syntax.
8. Add callback parameter support for non-capturing TypeC functions and extern symbols.
9. Add variadic extern declarations using rest syntax and C default-promotion-compatible argument
   checking.
10. Add C enum import after enum representation is implemented.
11. Add safe constant and simple macro import after constant semantics are implemented.
12. Keep unsupported C signatures skipped with diagnostics/debug visibility, not guessed
    declarations.

## Do

- Define ABI rules clearly.
- Use C-compatible layouts.
- Require explicit external declarations.
- Allow header-generated extern declarations only when derived from compiler AST output.
- Keep name mangling predictable.
- Use existing postfix pointer type syntax (`T*`) or canonical `Ptr<T>` in extern declarations.
- Allow `T[]` as pointer-decayed syntax for C ABI parameter arrays.
- Treat `u8*` / `Ptr<u8>` as the TypeC representation for C byte strings and `char*` interop.
- Prefer `Slice<T>` for TypeC-owned APIs that need pointer plus length.

## Do Not

- Do not guess C signatures.
- Do not silently change layout.
- Do not expose non-C-compatible features through C ABI.
- Do not treat raw pointer-decayed arrays as safe length-carrying slices.

---

# Phase 12: Compile-Time Constants

Implementation status: complete in the current prototype.

## Goal

Allow named module-level values that are evaluated by the compiler and emitted as C constants or
substituted literals.

## Syntax

Use TypeScript-like module-level `const` declarations with required type annotations:

```ts
const SCREEN_WIDTH: i32 = 800;
export const SCREEN_HEIGHT: i32 = 450;
export const TITLE: Ptr<u8> = "TypeC";
export const RAYWHITE: Color = { r: 245, g: 245, b: 245, a: 255 };
```

Local `const` statements remain runtime local declarations. Phase 12 adds only module-level
constants.

## Compile-Time Expressions

Phase 12 constants may use:

- integer, float, bool, and string literals
- record literals whose fields are compile-time expressions
- array literals whose elements are compile-time expressions
- unary `+` and `-` for numeric literals and constant expressions
- binary `+`, `-`, `*`, `/`, and `%` for numeric constant expressions
- references to earlier module-level constants from the same module or imported modules
- scoped enum members once Phase 14 is implemented

Phase 12 constants must not use function calls, pointer operators, assignment, indexing, field
access outside record literals, loops, conditionals, or runtime locals.

## Type Rules

- Every module-level constant must have an explicit type annotation.
- Constant values must be assignable to the annotated type using normal TypeC assignability rules.
- Integer constants must fit in the annotated integer type.
- Integer constant division and modulo by zero are invalid.
- Floating constants must fit in the annotated float type.
- Record constants must provide exactly the declared fields using existing record literal rules.
- Array constants must match the declared fixed array length when one is provided.
- String literals are NUL-terminated `Array<u8, N>` values and may initialize compatible `u8` array
  or pointer constants using the existing C string rules.

## C Emission

- Emit fixed-width TypeC C aliases, never raw C scalar spellings.
- Numeric and bool constants may be substituted at use sites or emitted as `static const` C values.
- Record and array constants emit as `static const` C objects with deterministic internal names
  unless exported through C ABI rules later.
- Exported TypeC constants are visible to TypeC imports. They are not exported as C ABI symbols
  unless a later phase explicitly defines C symbol export for constants.

## C Header Constants and Macros

Header imports may generate TypeC constants only for compiler-derived, deterministic values that can
be represented by Phase 12 constant expressions. Object-like macros and `const` variables may import
when their type and value are known and C-compatible. Function-like macros, macros requiring target
side effects, macros depending on unsupported C syntax, and values without deterministic compiler
representation are skipped safely.

## Do

- Keep evaluation deterministic and side-effect free.
- Reject values that cannot be represented in their declared TypeC type.
- Emit fixed-width C types and literals.
- Preserve TypeScript-like `const NAME: Type = value;` syntax.
- Keep imported constants namespaced by normal import rules.

## Do Not

- Do not add macros as a substitute for typed constants.
- Do not evaluate function calls.
- Do not introduce hidden runtime initialization.
- Do not infer module-level constant types in this phase.
- Do not import unsafe or target-dependent macros by guessing.

---

# Phase 13: Switch Statements

Status: Complete.

## Goal

Add TypeScript-like `switch` statements for explicit multi-way branching over integer-like values
and, once implemented, enum values.

## Syntax

Use TypeScript-like `switch`, `case`, `default`, and `break` syntax:

```ts
function classify(value: i32): i32 {
  switch (value) {
    case 0:
      return 10;
    case 1:
      return 20;
    default:
      return 30;
  }
}
```

Enum switches use scoped enum members once Phase 14 is implemented:

```ts
switch (key) {
  case Key.Space:
    return 1;
  case Key.Escape:
    return 2;
  default:
    return 0;
}
```

## Semantics

- The switch expression must be an integer type, `bool`, or an enum type after enums exist.
- Case labels must be compile-time constants assignable to the switch expression type.
- Duplicate case values in the same switch are invalid.
- `default` is optional and may appear at most once.
- Case bodies are statement lists.
- `break;` exits the nearest switch.
- Fallthrough follows TypeScript/C semantics: execution continues into the next case unless a
  `break`, `return`, or other explicit control-flow exit is reached.
- Multiple labels may share a body by placing labels next to each other with no intervening
  statements.

## C Emission

- Lower to a C `switch` when TypeC semantics map directly and safely.
- Emit fixed-width switch expressions and case labels.
- Preserve TypeScript/C fallthrough, explicit `break`, and `return` behavior.

## Do

- Keep syntax and fallthrough behavior TypeScript-like.
- Type-check case labels against the switch expression.
- Keep lowering readable and deterministic.

## Do Not

- Do not add non-switch branching semantics.
- Do not use dynamic type tests.
- Do not allow case labels that require runtime evaluation.

---

# Phase 14: Enums

Status: Complete.

## Goal

Add simple scoped sets of named integer values.

## Syntax

Use TypeScript-like enum declarations:

```ts
enum Key {
  Space = 32,
  Escape = 256,
}

export enum Direction {
  Up,
  Down,
  Left,
  Right,
}

function main(): i32 {
  const key: Key = Key.Space;
  return 0;
}
```

Enum members are always accessed through the enum scope:

```ts
Key.Space;
Direction.Up;
```

Unqualified member access such as `Space` is invalid unless imported as an explicitly named constant
by a later import rule.

## Representation

- The default backing type is `i32`.
- Member values are deterministic integer constants.
- A member without an initializer has value `previous + 1`, or `0` for the first member.
- Initializers must be Phase 12 integer constant expressions.
- Member values must fit in `i32` until explicit backing-type syntax is specified later.
- Duplicate member names are invalid.
- Duplicate member values are allowed.

## Type Rules

- Each enum declaration introduces a distinct nominal type.
- Enum members have the enum type, not raw `i32`.
- Enum values may be compared for equality with values of the same enum type.
- Enum values may be explicitly cast to their backing integer type only after a later phase defines
  source-level cast syntax. Until then, enum-to-integer conversion is not available in TypeC source.
- Raw integers are not implicitly assignable to enum types.
- Enum values are not implicitly assignable to integer types.

## C Emission

- Do not emit C `enum` for TypeC enums, because C enum size is implementation-defined.
- Emit the enum type as a fixed-width alias using the backing TypeC integer alias, e.g.
  `typedef i32 Key;`.
- Emit members as deterministic constants using Phase 12 constant emission rules.
- Use scoped internal C names for members, e.g. `Key_Space`, to avoid global C symbol collisions.

## C Header Enum Import

C header enums may import only when the compiler AST provides deterministic integer values. Imported
C enum constants are exposed through the header module namespace. A C enum with a usable name
imports as a TypeC enum type with scoped members. Anonymous or unscoped C enum constants may import
as namespaced Phase 12 integer constants when no safe enum type can be formed.

Examples:

```ts
import * as RL from "raylib";

const key: RL.KeyboardKey = RL.KeyboardKey.KEY_SPACE;
const mode: i32 = RL.FLAG_WINDOW_RESIZABLE;
```

## Do

- Keep enum members scoped.
- Use TypeScript-like `enum Name { Member = value }` syntax.
- Use fixed-width integer aliases for representation.
- Require deterministic discriminant values.
- Type-check enum values distinctly from raw integers.

## Do Not

- Do not add payloads in this phase.
- Do not rely on C enum implementation-defined sizes.
- Do not add implicit integer-to-enum or enum-to-integer conversions.

---

# Phase 15: Classes and Methods

Status: Complete.

## Goal

Add static-layout data types with associated functions, lowered predictably to records and
functions.

## Syntax

Use TypeScript-like `class` declarations and method syntax:

```ts
class Vec2 {
  x: f64;
  y: f64;

  lengthSquared(): f64 {
    return this.x * this.x + this.y * this.y;
  }
}

function main(): i32 {
  const v: Vec2 = { x: 3.0, y: 4.0 };
  const d: f64 = v.lengthSquared();
  return 0;
}
```

Constructors, inheritance, access modifiers, static members, and `new` are not part of this phase
unless specified by a later design update.

## Semantics

- A class declaration defines a nominal record-shaped type with the declared fields.
- A method declaration lowers to a function named by the class scope with an explicit `this`
  receiver parameter of the class type.
- A method call `value.method(args)` resolves statically from the receiver type and emits a direct C
  function call with `value` passed as the first argument.
- Method bodies may access fields through `this.field`.
- Class values are initialized with existing record literal syntax.

## Do

- Keep object layout static and C-compatible where possible.
- Lower methods to explicit functions with an explicit receiver.
- Reuse record field checking rules.
- Keep dispatch static.
- Keep syntax close to TypeScript class and method declarations.

## Do Not

- Do not add prototypes.
- Do not add runtime reflection.
- Do not add implicit heap allocation.
- Do not add inheritance in this phase.

---

# Phase 16: Interfaces

Status: Complete.

## Goal

Add compile-time constraints for generic or static-dispatch code.

## Syntax

Use TypeScript-like `interface` declarations:

```ts
interface Drawable {
  draw(): void;
}
```

Interfaces are compile-time constraints in this phase. Runtime dispatch, dynamic objects, and
TypeScript structural compatibility rules are not implied unless specified explicitly.

## Semantics

- Interface declarations introduce compile-time-only type names.
- Interface members are method signatures only in this phase.
- Duplicate member names are invalid.
- Interface method parameter and return types are checked with the same type-reference rules as
  function signatures.
- Interface names are not value types. A function parameter, local, field, or return type cannot use
  an interface name until a later phase defines generic constraints or another valid use site.
- Interfaces emit no C.

## Do

- Keep interfaces compile-time only unless runtime dispatch is explicitly specified later.
- Define satisfaction rules structurally or nominally before implementation.
- Require clear diagnostics for missing members.
- Keep generated C monomorphic and explicit.
- Keep syntax close to TypeScript interface declarations.

## Do Not

- Do not add dynamic dispatch by accident.
- Do not add runtime type information.
- Do not copy TypeScript interface semantics blindly beyond syntax shape.

---

# Phase 17: Generics

Status: Complete.

## Goal

Allow reusable typed functions and data structures through compile-time instantiation.

## Syntax

Use TypeScript-like generic parameter syntax:

```ts
function first<T>(items: Slice<T>): T {
  return items[0];
}

class Box<T> {
  value: T;
}
```

Generic constraints use TypeScript-like `extends` syntax only if Phase 16 interface constraints are
specified:

```ts
function drawAll<T extends Drawable>(items: Slice<T>): void {
  // body syntax depends on earlier implemented phases
}
```

Generic functions instantiate explicitly:

```ts
function identity<T>(value: T): T {
  return value;
}

function main(): i32 {
  return identity<i32>(42);
}
```

## Semantics

- Generic function declarations use TypeScript-like `function name<T>(...)` syntax.
- Generic class declarations use TypeScript-like `class Name<T> { ... }` syntax.
- Generic calls must use explicit TypeScript-like type arguments: `name<i32>(value)`.
- Generic class values must use explicit TypeScript-like type arguments: `Box<i32>`.
- Generic function and class templates are compile-time only and emit no C directly.
- Each concrete call monomorphizes the template into a non-generic function before resolution,
  checking, and C emission.
- Instantiation C names are deterministic and include sanitized type argument names.
- Generic type parameters may appear in parameter types, return types, class fields, method
  signatures, local declarations, and nested type references.
- Generic type parameters may use TypeScript-like interface constraints: `T extends Drawable`.
- Constraint satisfaction is structural over class instance methods: the concrete type must provide
  every interface method name with the same parameter count and return type after receiver removal.
- Generic type parameters may not be shadowed or duplicated in the same declaration.
- Generic function type inference is not implemented; omitting call type arguments calls only
  ordinary non-generic functions.

## Do

- Define monomorphization rules.
- Define generic type parameter constraints.
- Emit deterministic C names for instantiations.
- Keep diagnostics tied to source generic definitions and call sites.
- Keep syntax close to TypeScript generic declarations.

## Do Not

- Do not add type erasure unless explicitly designed.
- Do not emit runtime generic metadata.
- Do not allow unconstrained operations on unknown types.

---

# Phase 18: Defer

Status: Complete.

## Goal

Allow explicit scope-exit cleanup without hidden ownership semantics.

## Syntax

Use an explicit `defer` statement with a call expression:

```ts
function main(): i32 {
  InitWindow(800, 450, "TypeC");
  defer CloseWindow();

  draw();
  return 0;
}
```

Only call-expression defers are in scope for this phase:

```ts
defer cleanup();
defer release(handle);
```

## Semantics

- `defer` is scope-specific.
- A deferred call runs when execution leaves the block where the `defer` statement appears.
- Deferred calls run first-in, last-out within that block.
- A `defer` near the top of a function runs after later defers in the same function scope.
- Local block defers run before outer block defers.
- Deferred calls run on ordinary fallthrough and on `return` from the scope.

Example execution order:

```ts
function main(): i32 {
  defer CloseWindow();
  defer StopAudio();
  return 0;
}
```

Execution order on return:

```txt
StopAudio()
CloseWindow()
return 0
```

## C Emission

- Lower to explicit C statements at each scope exit.
- Preserve first-in, last-out order by emitting deferred calls in reverse declaration order.
- For `return expr;`, evaluate `expr` once into a temporary when required, run defers, then return
  the stored value.
- For `return;`, run defers before the C `return;`.
- Nested block defers are emitted before outer block defers when control exits both scopes.

## Do

- Keep execution order precise and visible in emitted C.
- Run deferred actions on all local exits from the scope.
- Keep deferred calls type-checked like normal call statements.
- Keep `defer CloseWindow();` as the primary syntax for resource cleanup.

## Do Not

- Do not implement exceptions.
- Do not hide allocation or ownership behavior.
- Do not defer arbitrary expressions in this phase.
- Do not allow control flow that cannot be lowered clearly to C.

---

# Phase 19: Safe Pointer Modes

Status: Complete.

## Goal

Add stricter pointer categories or annotations that improve safety while preserving explicit memory
behavior.

## Syntax

Phase 19 introduces one explicit safe pointer type constructor:

```ts
SafePtr<T>;
```

`SafePtr<T>` is a checked, non-null, mutable, non-owning pointer to `T`.

- Aliasing: aliasing is allowed; Phase 19 does not implement exclusive pointers.
- Nullability: non-null by construction. TypeC currently has no `null` literal; implicit raw
  `Ptr<T>`/`T*` to `SafePtr<T>` conversion is rejected.
- Mutability: pointee mutability is unchanged from raw `Ptr<T>`; no readonly mode is added in this
  phase.
- Ownership: non-owning; no allocation, free, drop, or lifetime inference is added.

`SafePtr<T>` may be initialized or passed from `Ref<T>`/`T&` produced by explicit address-of
`expr.&`. `SafePtr<T>` may be passed where raw `Ptr<T>`/`T*` or `void*` is expected for C interop.
It lowers to the same C representation as `Ptr<T>`: `T*`.

No other pointer modes are specified in Phase 19.

## Do

- Define each pointer mode's aliasing, nullability, and mutability rules.
- Keep lowering to C explicit and auditable.
- Reject unsafe conversions unless explicitly written and specified.
- Preserve existing raw pointer interop rules.

## Do Not

- Do not promise memory safety without enforceable rules.
- Do not infer ownership silently.
- Do not break C ABI compatibility for raw pointers.
- Do not implement before exact syntax is specified.

---

# Phase 20: Arenas

Status: Complete.

## Goal

Add explicit region-style allocation as a standard memory-management pattern.

## Syntax

Phase 20 introduces one built-in arena handle type and three built-in functions:

```ts
const arena: Arena = arenaCreate();
defer arenaDestroy(arena);
const value: SafePtr<i32> = arenaAlloc(arena, 1);
```

- `Arena` is an opaque non-owning handle in TypeC source; emitted C represents it as a pointer to a
  TypeC runtime arena object.
- `arenaCreate(): Arena` creates an arena handle.
- `arenaDestroy(arena: Arena): void` releases every allocation owned by the arena and the arena
  handle itself. It is intended to be paired with `defer` at the creation scope.
- `arenaAlloc(arena: Arena, count: usize)` requires an expected `SafePtr<T>` target type and returns
  storage for `count` contiguous `T` values.
- Allocation failure aborts the process through portable C `abort()`; Phase 20 does not add nullable
  pointers, exceptions, or result types.
- Arena allocation is non-GC region allocation. Individual arena allocations cannot be freed.
- `arenaAlloc` lowers to an explicit runtime allocation call using `sizeof(T) * count`.

No other arena declarations, allocation forms, failure modes, or ownership inference are specified
in Phase 20.

## Do

- Make arena lifetime explicit.
- Define allocation failure behavior.
- Lower to portable C runtime support only if specified.
- Keep interaction with `defer` clear.

## Do Not

- Do not add garbage collection.
- Do not hide allocation behind ordinary value construction.
- Do not make arenas required for programs that do not use them.
- Do not implement before exact syntax is specified.

---

# Phase 21: Tagged Unions

Status: Complete. Minimal explicit `union` subset implemented.

## Goal

Add sum types with explicit variants and payloads.

## Syntax

Phase 21 introduces one tagged union declaration form:

```ts
union MaybeI32 {
  Some: i32;
  None;
}
```

Construction is explicit through qualified variant calls:

```ts
const value: MaybeI32 = MaybeI32.Some(42);
const empty: MaybeI32 = MaybeI32.None();
```

Access is explicit through fields:

```ts
value.tag; // i32 tag value
value.Some; // payload field for payload variants
```

Phase 21 does not add pattern matching or exhaustiveness checking. Existing `switch` may switch on
`.tag`. Payload access is unchecked at runtime in this minimal phase; programs must check `.tag`
first when needed.

## Representation

A tagged union lowers to a C struct with an `i32 tag` field and a C `union data` field. Each variant
gets a deterministic `i32` tag constant in declaration order starting at zero. Payload variants
store payloads in `data.<Variant>`. Payload-free variants have no payload field. Construction emits
a C compound literal setting `tag` and, for payload variants, the corresponding payload field.

## Do

- Define representation as a tag plus payload storage.
- Require explicit construction of variants.
- Check payload types statically.
- Emit portable C structs/unions only after layout is specified.

## Do Not

- Do not rely on unspecified C layout.
- Do not add implicit conversions between variants.
- Do not implement before exact syntax is specified.

---

# Phase 22: Language Server Protocol

Status: Complete. Minimal editor diagnostics subset implemented.

## Goal

Add a small LSP server so editors can validate TypeC files while editing.

## Protocol

Phase 22 implements a JSON-RPC 2.0 Language Server Protocol server over stdio.

Supported client messages:

- `initialize`
- `initialized`
- `shutdown`
- `exit`
- `textDocument/didOpen`
- `textDocument/didChange`
- `textDocument/didClose`

Server output:

- `initialize` response with full text-document sync
- `textDocument/publishDiagnostics` notifications

## Diagnostics

Diagnostics are computed from the in-memory document text with the completed lexer and parser. This
phase reports lexical and syntactic diagnostics only. It does not run module loading, name
resolution, type checking, C emission, or native compilation from the LSP.

LSP ranges are zero-based. TypeC compiler diagnostics are one-based internally and are converted at
the LSP boundary.

## CLI

The driver adds:

```bash
deno run -A src/driver/main.ts lsp
```

## Do

- Keep the LSP transport separate from diagnostics.
- Keep JSON-RPC framing reusable and testable.
- Use only portable stdio and JSON-RPC protocol behavior.
- Publish empty diagnostics when a document becomes valid.

## Do Not

- Do not add new TypeC language syntax.
- Do not implement autocomplete, hover, go-to-definition, formatting, or semantic diagnostics in
  this phase.
- Do not compile or execute user programs from the LSP.

---

# Phase 23: TypeScript-Style Expression Operators

Status: In progress. Logical `!` / `!!`, ternary `? :`, and optional type spelling `T?` subsets
implemented.

## Goal

Add the TypeScript expression syntax users expect for boolean negation, conditional expressions, and
explicit optional/null-aware access, without adopting JavaScript runtime semantics.

Phase 23 extends expressions only. It does not add `any`, implicit `undefined`, dynamic property
lookup, prototype behavior, or JavaScript truthiness.

## Syntax

Logical unary operators:

```ts
+expr;
-expr;
!expr;
!!expr;
~expr;
```

`+expr` and `-expr` already exist for numeric expressions. Phase 23 adds `!expr` and reserves
`~expr` for integer bitwise-not once bitwise operators are implemented. `!!expr` is parsed as two
unary `!` operators, exactly like TypeScript. It is not a separate token or special cast form.

Additional TypeScript unary/update syntaxes are reserved and must be specified before
implementation:

```ts
++expr;
--expr;
expr++;
expr--;
typeof expr;
void expr;
delete expr;
await expr;
```

`delete`, `void`, and `await` have JavaScript runtime meanings and are not valid TypeC Phase 23
operators. They remain reserved tokens/syntax forms so diagnostics can be explicit instead of
misparsing them. `typeof` may later become compile-time type introspection, not JavaScript runtime
reflection. `++` and `--` may later be added as typed numeric update operators, but are not part of
Phase 23 expression semantics unless separately specified.

Conditional expression:

```ts
condition ? whenTrue : whenFalse;
```

Null-aware optional syntax:

```ts
expr?.field
expr?.method(arg0, arg1)
expr?.[index]
expr ?? fallback
expr ?: fallback
expr!
T?
```

`expr ?: fallback` is the Elvis shorthand for `expr ?? fallback`. `??` remains the canonical
TypeScript-like spelling. `expr!` is a non-null assertion expression. `T?` is shorthand for an
explicit optional type.

## Semantics

Logical not:

- `!expr` requires `expr: bool` and returns `bool`.
- `!!expr` therefore requires `expr: bool` and returns `bool`.
- `~expr` is reserved for integer bitwise-not and is invalid until bitwise integer operators are
  specified.
- TypeC does not use JavaScript truthiness; integers, pointers, records, arrays, and enums are not
  implicitly converted to `bool`.

Conditional expression:

- `condition ? a : b` requires `condition: bool`.
- Both branches must have the same type or an existing assignable common type.
- Only the selected branch is evaluated at runtime.
- Lowering emits a C conditional expression when both branches are expression-safe; otherwise the
  compiler may lower through a temporary in generated C.

Optional type spelling:

- `T?` is shorthand for `Optional<T>`.
- Optional values are explicit values, not implicit `null` or `undefined`.
- `T?` is implemented for type positions; value constructors are not implemented yet.
- Phase 23 may introduce explicit `some(value)` / `none<T>()` constructors or equivalent documented
  constructors before value construction is implemented.
- `T?` is not allowed for `void`.

Optional chaining:

- `expr?.field`, `expr?.method(...)`, and `expr?.[index]` require `expr` to be optional.
- If `expr` is empty, the result is empty.
- If `expr` contains a value, the access is performed on the contained value.
- The result type is optional when the access result is a value type.

Nullish coalescing and Elvis:

- `expr ?? fallback` requires `expr` to be optional and `fallback` to be assignable to the contained
  type.
- `expr ?: fallback` has the same semantics as `expr ?? fallback`.
- The result type is the contained non-optional type.
- `fallback` is evaluated only when `expr` is empty.

Non-null assertion:

- `expr!` requires `expr` to be optional and returns the contained non-optional type.
- If `expr` is empty at runtime, behavior is a checked trap/abort in debug-safe lowering; unchecked
  lowering may be specified later but is not the default.
- `expr!` is explicit and local; it does not change the variable's declared type.

## Precedence

From high to low, Phase 23 expression precedence is:

1. postfix access/call/index/non-null: `()`, `[]`, `.`, `?.`, `!`
2. prefix unary: `!`, `+`, `-`
3. multiplicative: `*`, `/`, `%`
4. additive: `+`, `-`
5. comparison/equality: `<`, `<=`, `>`, `>=`, `==`, `!=`
6. nullish/elvis: `??`, `?:`
7. ternary conditional: `? :`

Postfix non-null assertion `expr!` binds tighter than prefix `!expr`.

## Examples

```ts
function shouldRun(closed: bool): bool {
  return !closed;
}

function asBool(value: bool): bool {
  return !!value;
}

function pick(flag: bool, a: i32, b: i32): i32 {
  return flag ? a : b;
}

function fallback(value: i32?): i32 {
  return value ?? 42;
}

function fallbackElvis(value: i32?): i32 {
  return value ?: 42;
}
```

## Do

- Keep all conversions explicit and statically typed.
- Require boolean conditions for `!` and `? :`.
- Keep optionality explicit through `T?` / `Optional<T>`.
- Lower to readable C with predictable evaluation order.
- Add parser, checker, emitter, and runtime tests before marking complete.

## Do Not

- Do not add JavaScript truthiness.
- Do not add implicit `null` or `undefined`.
- Do not allow optional chaining on non-optional values.
- Do not make `?` mean dynamic property lookup or weak typing.
- Do not add optional parameters or optional object fields in this phase unless separately
  specified.
- Do not implement JavaScript-runtime unary operators `delete`, `void`, or `await`.

---

# Future Features

Only add after their syntax, semantics, examples, lowering, and tests are documented.

Possible future work:

- package manager
- inheritance, if ever needed
- runtime dynamic dispatch, if explicitly chosen
- garbage collection, only if TypeC explicitly chooses that path later

## Do

- Add features only when their lowering to C is clear.
- Write examples before implementation.
- Keep semantics non-magical.

## Do Not

- Do not copy TypeScript features blindly.
- Do not add features that require a JS runtime.
- Do not add features that require GC unless TypeC explicitly chooses that path later.

---

# Global Design Rules

## TypeC Must Be

- statically typed
- ahead-of-time compiled
- deterministic
- C-emittable
- explicit about memory
- strict by default
- practical for systems code

## TypeC Must Not Be

- JavaScript
- TypeScript runtime-compatible
- dynamically typed
- garbage-collected by default
- dependent on V8, Deno, Node, or browsers at runtime
- a full TypeScript compiler clone

---

# High-Level Do List

Do:

- keep TS-like syntax
- use `.tc`
- compile to readable C
- build with Deno + TypeScript initially
- keep compiler phases separate
- write tests for every phase
- keep diagnostics excellent
- start with tiny programs
- make memory explicit
- make object layout static
- make imports static
- reject unclear programs

---

# High-Level Do Not List

Do not:

- support `any`
- support implicit `undefined`
- support implicit `null`
- support dynamic property access as default
- support monkey patching
- support prototypes
- support `eval`
- support arbitrary JS libraries
- support hidden heap allocation
- support a garbage collector initially
- chase full TypeScript compatibility
- emit C before type checking
- make the parser responsible for semantic checks

---

# First Working Target

Input: `examples/main.tc`

```ts
function main(): i32 {
  return 0;
}
```

Generated C:

```c
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef int32_t i32;

i32 main(void) {
  return 0;
}
```

Command:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```

This is the first milestone. Everything else comes after this works reliably.
