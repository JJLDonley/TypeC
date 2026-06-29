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

## Fixed Array Initialization

Fixed arrays support explicit zero/default initialization and static fill construction:

```ts
let zeroed: i32[16] = {0};
let canonical: Array<i32, 16> = {0};
let repeated: i32[4] = Array.fill(7);
let indexed: usize[4] = Array.fill((i) => i + 1);
```

`{0}` is TypeC zero/default initialization shorthand. For fixed arrays it initializes every element
with the element type's zero/default representation and emits portable C aggregate initialization.

`Array.fill(value)` requires an expected fixed array type and initializes every element with
`value`. `Array.fill((i) => expr)` is a static indexed fill form; `i` has type `usize`, the callback
result must match the array element type, and the compiler emits a fixed aggregate initializer.

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

Status: Complete. Logical `!` / `!!`, ternary `? :`, optional type spelling `T?`, postfix non-null
assertion `expr!`, nullish coalescing / Elvis, and optional chaining implemented.

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
- This syntax is implemented.

Nullish coalescing and Elvis:

- `expr ?? fallback` requires `expr` to be optional and `fallback` to be assignable to the contained
  type.
- `expr ?: fallback` has the same semantics as `expr ?? fallback`.
- The result type is the contained non-optional type.
- `fallback` is evaluated only when `expr` is empty.
- This syntax is implemented.

Non-null assertion:

- `expr!` requires `expr` to be optional and returns the contained non-optional type.
- If `expr` is empty at runtime, generated C aborts through a checked unwrap helper. Unchecked
  lowering may be specified later but is not the default.
- `expr!` is implemented.
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

# Phase 24: Bitwise Integer Operators

Status: Complete.

## Goal

Add TypeScript-style bitwise expression syntax for fixed-width integer types without JavaScript's
32-bit coercions, signedness surprises, or dynamic conversion rules.

## Syntax

Unary bitwise not:

```ts
~expr;
```

Binary bitwise operators:

```ts
a & b;
a | b;
a ^ b;
a << n;
a >> n;
a >>> n;
```

Assignment/update forms such as `&=`, `|=`, `^=`, `<<=`, `>>=`, `>>>=`, `++`, and `--` are not part
of this phase.

## Semantics

- All bitwise operands must be fixed-width integer types.
- Binary `&`, `|`, and `^` require both operands to have the same integer type and return that type.
- Shift left `<<`, arithmetic shift right `>>`, and logical shift right `>>>` require an integer
  left operand and an unsigned integer shift count.
- Shift expressions return the left operand type.
- Shift counts must be less than the bit width of the left operand when known at compile time.
- `>>>` is valid only for unsigned integer left operands.
- `~expr` requires an integer operand and returns the same type.
- TypeC does not use JavaScript `ToInt32`, `ToUint32`, truthiness, or numeric coercion.
- Floating-point, bool, pointer, array, record, enum, optional, and string operands are rejected.

## Precedence

From high to low within existing expression precedence:

1. prefix unary: `~`, `!`, `+`, `-`
2. multiplicative: `*`, `/`, `%`
3. additive: `+`, `-`
4. shifts: `<<`, `>>`, `>>>`
5. comparison/equality: `<`, `<=`, `>`, `>=`, `==`, `!=`
6. bitwise AND: `&`
7. bitwise XOR: `^`
8. bitwise OR: `|`
9. nullish/elvis: `??`, `?:`
10. ternary conditional: `? :`

## Examples

```ts
function mask(value: u32): u32 {
  return value & 255;
}

function high(value: u32): u32 {
  return value >>> 24;
}

function invert(value: u8): u8 {
  return ~value;
}
```

## Do

- Preserve the static TypeC integer type through every bitwise operation.
- Emit plain C bitwise operators only after checking signedness and shift bounds.
- Add lexer, parser, checker, emitter, and compile tests.

## Do Not

- Do not add JavaScript numeric coercions.
- Do not allow bitwise operators on floats, bools, pointers, records, arrays, or optionals.
- Do not add assignment or update operators in this phase.

---

# Phase 25: Logical Binary Operators

Status: Complete.

## Goal

Add TypeScript-style `&&` and `||` expression syntax with static boolean semantics and C-style
short-circuit lowering, without JavaScript truthiness or value propagation.

## Syntax

```ts
a && b;
a || b;
```

Assignment forms such as `&&=` and `||=` are not part of this phase.

## Semantics

- `a && b` requires `a: bool` and `b: bool`, evaluates `b` only when `a` is true, and returns
  `bool`.
- `a || b` requires `a: bool` and `b: bool`, evaluates `b` only when `a` is false, and returns
  `bool`.
- TypeC does not use JavaScript truthiness; integers, pointers, optionals, arrays, records, enums,
  and strings are not implicitly converted to `bool`.
- Unlike JavaScript, `&&` and `||` do not return one of their operands. They always return `bool`.

## Precedence

From high to low within existing expression precedence:

1. prefix unary: `~`, `!`, `+`, `-`
2. multiplicative: `*`, `/`, `%`
3. additive: `+`, `-`
4. shifts: `<<`, `>>`, `>>>`
5. comparison/equality: `<`, `<=`, `>`, `>=`, `==`, `!=`
6. bitwise AND: `&`
7. bitwise XOR: `^`
8. bitwise OR: `|`
9. logical AND: `&&`
10. logical OR: `||`
11. nullish/elvis: `??`, `?:`
12. ternary conditional: `? :`

## Examples

```ts
function both(a: bool, b: bool): bool {
  return a && b;
}

function either(a: bool, b: bool): bool {
  return a || b;
}
```

## Do

- Require both operands to be `bool`.
- Preserve short-circuit evaluation in emitted C.
- Add lexer, parser, checker, emitter, and compile tests.

## Do Not

- Do not add JavaScript truthiness.
- Do not make `&&` or `||` return non-bool operand values.
- Do not add logical assignment operators in this phase.

---

# Phase 26: Compound Assignment Statements

Status: Complete.

## Goal

Add TypeScript-style compound assignment statement syntax for already-supported numeric and bitwise
operators, while preserving TypeC's static typing and statement-only assignment model.

## Syntax

```ts
x += value;
x -= value;
x *= value;
x /= value;
x %= value;
x <<= count;
x >>= count;
x >>>= count;
x &= value;
x ^= value;
x |= value;
```

Logical and nullish assignment forms `&&=`, `||=`, and `??=` are not part of this phase. Increment
and decrement `++` / `--` are not part of this phase.

## Semantics

- Compound assignment is a statement, not an expression.
- The left side is an existing mutable local variable, as with `=` assignment.
- `x op= y` is checked like `x = x op y`, using the existing operator rules for `op`.
- The resulting operation type must be assignable to the local variable type.
- Array variables remain non-assignable.
- The right operand is evaluated once.
- TypeC does not add JavaScript numeric coercions or truthiness.

## Examples

```ts
function add(value: i32): i32 {
  let total: i32 = 0;
  total += value;
  return total;
}

function mask(value: u32): u32 {
  let bits: u32 = value;
  bits &= 255;
  return bits;
}
```

## Do

- Reuse existing binary operator type rules.
- Emit direct C compound assignment operators after checking.
- Add parser, checker, emitter, and compile tests.

## Do Not

- Do not make assignments expressions.
- Do not add logical/nullish assignment in this phase.
- Do not add implicit conversions.

---

# Phase 27: Increment and Decrement Statements

Status: Complete.

## Goal

Add TypeScript-style `++` and `--` syntax for local integer mutation without adding
expression-valued assignment semantics.

## Syntax

```ts
value++;
value--;
++value;
--value;
```

## Semantics

- Increment and decrement are statements, not expressions.
- The target must be an existing mutable local variable.
- The target type must be an integer type.
- Array variables remain non-assignable.
- `value++` and `++value` have the same statement effect: `value += 1`.
- `value--` and `--value` have the same statement effect: `value -= 1`.
- TypeC does not expose JavaScript prefix/postfix result-value differences.
- TypeC does not add JavaScript coercions, wrapping promises, or dynamic property mutation.

## Examples

```ts
function next(value: i32): i32 {
  let current: i32 = value;
  current++;
  return current;
}

function previous(value: u32): u32 {
  let current: u32 = value;
  --current;
  return current;
}
```

## Do

- Parse prefix and postfix forms only as statements.
- Check mutability and integer target type statically.
- Emit direct C `++` / `--` statements after checking.
- Add lexer, parser, checker, emitter, and compile tests.

## Do Not

- Do not add `++` / `--` expressions.
- Do not permit fields, indexes, pointers, or arbitrary lvalues in this phase.
- Do not add implicit conversions.

---

# Phase 28: Do-While Statements

Status: Complete.

## Goal

Add TypeScript-style `do...while` loop syntax for cases where the loop body must execute before the
condition is checked.

## Syntax

```ts
do {
  statements;
} while (condition);
```

## Semantics

- `do...while` is a statement.
- The body executes once before checking the condition.
- The condition must have type `bool`.
- The loop body has the same block-local scoping rules as `while`.
- `break` has the same meaning as in existing loop/switch control flow.
- TypeC does not add JavaScript truthiness or implicit coercions.

## Examples

```ts
function runOnce(value: i32): i32 {
  let current: i32 = value;
  do {
    current++;
  } while (current < 3);
  return current;
}
```

## Do

- Reuse existing boolean condition checks.
- Emit direct portable C `do { ... } while (condition);`.
- Preserve existing defer handling around loop exits.
- Add parser, checker, emitter, and compile tests.

## Do Not

- Do not add labelled breaks or continues in this phase.
- Do not add truthiness.
- Do not add `while` expression values.

---

# Phase 29: Else-If Chains

Status: Complete.

## Goal

Add TypeScript-style `else if` syntax as structured conditional sugar without changing TypeC's
static control-flow semantics.

## Syntax

```ts
if (condition) {
  statements;
} else if (other) {
  statements;
} else {
  statements;
}
```

## Semantics

- `else if` is parsed as a nested `if` statement in the `else` branch.
- Each condition must have type `bool`, as with existing `if` statements.
- Each branch keeps existing block-local scoping rules.
- TypeC does not add JavaScript truthiness or implicit coercions.

## Examples

```ts
function classify(value: i32): i32 {
  if (value < 0) {
    return -1;
  } else if (value == 0) {
    return 0;
  } else {
    return 1;
  }
}
```

## Do

- Reuse existing `if` AST, checker, and emitter behavior.
- Add parser and compile tests.
- Preserve existing diagnostics for non-bool conditions.

## Do Not

- Do not add pattern matching.
- Do not add truthiness.
- Do not add new branch expression values.

---

# Phase 30: Empty Statements

Status: Complete.

## Goal

Add TypeScript-style empty statement syntax for intentional no-op statement positions.

## Syntax

```ts
```

## Semantics

- An empty statement is a statement that performs no operation.
- It has no type and no runtime value.
- It does not create a scope.
- It is valid anywhere an ordinary statement is valid.
- TypeC does not add JavaScript automatic semicolon insertion semantics.

## Examples

```ts
function main(): i32 {
  return 0;
}
```

## Do

- Parse a standalone semicolon as an empty statement.
- Emit a portable C empty statement `;`.
- Add parser, lowering, checker dispatch, emitter, and compile tests.

## Do Not

- Do not add automatic semicolon insertion.
- Do not change expression statement rules.
- Do not add labelled statements.

---

# Phase 31: Trailing Commas in Delimited Lists

Status: Complete.

## Goal

Add TypeScript-style trailing comma tolerance in comma-delimited syntax lists where it does not
affect type checking or emitted C.

## Syntax

```ts
function sum(
  a: i32,
  b: i32,
): i32 {
  return a + b;
}

sum(
  1,
  2,
);

const values: [i32] = [
  1,
  2,
];
```

## Semantics

- A trailing comma is syntax only.
- It does not create an empty element, parameter, argument, field, or variant.
- It does not affect type checking, lowering, or C emission.
- TypeC does not add JavaScript array holes or elisions.

## Covered Lists

- Function parameters.
- Function call arguments.
- Generic type arguments and parameters where already supported.
- Array literal elements.
- Record literal fields.
- Record type fields are semicolon-delimited today and remain unchanged.

## Do

- Accept one optional trailing comma before the closing delimiter in covered lists.
- Keep existing diagnostics for missing list elements.
- Add parser and compile tests.

## Do Not

- Do not add omitted elements like `[1,,2]`.
- Do not add rest/spread syntax.
- Do not change emitted C formatting or semantics.

---

# Phase 32: Numeric Separators in Decimal Literals

Status: Complete.

## Goal

Add TypeScript-style `_` separators inside decimal integer and float literals for readability.

## Syntax

```ts
const thousand: i32 = 1_000;
const scale: f64 = 1_000.25_5;
```

## Semantics

- Numeric separators are syntax only.
- The checker sees the same literal value as if separators were omitted.
- Emitted C uses normalized literals without separators.
- Only decimal literals supported by TypeC today are covered.

## Do

- Accept `_` only between two decimal digits inside integer and fractional parts.
- Reject leading, trailing, and consecutive numeric separators.
- Add lexer and compile tests.

## Do Not

- Do not add binary, octal, hexadecimal, bigint, exponent, or signed literal syntax.
- Do not add JavaScript numeric coercions or runtime semantics.

---

# Phase 33: Single-Quoted String Literals

Status: Complete.

## Goal

Accept TypeScript-style single-quoted string literals as an alternate spelling for TypeC string
literals.

## Syntax

```ts
extern function puts(s: u8*): i32;

function main(): i32 {
  return puts('hello');
}
```

## Semantics

- Single-quoted and double-quoted string literals produce the same TypeC string literal node.
- The quote style is syntax only and does not affect type checking or emitted C.
- Emitted C keeps using normal C double-quoted string literals.

## Do

- Accept `'text'` wherever string literals are accepted today.
- Reuse existing string literal checker and emitter behavior.
- Add lexer and compile tests.

## Do Not

- Do not add template literals.
- Do not add string interpolation.
- Do not add escape-sequence semantics beyond what TypeC already supports.
- Do not add JavaScript `String` object or runtime behavior.

---

# Phase 34: Record Literal Field Shorthand

Status: Complete.

## Goal

Add TypeScript-style record literal field shorthand for local values whose identifier matches the
record field name.

## Syntax

```ts
type Point = { x: i32; y: i32 };

function make(x: i32, y: i32): Point {
  return { x, y };
}
```

## Semantics

- `{ x }` is syntax sugar for `{ x: x }`.
- The shorthand expression is a normal identifier expression and is resolved and type checked like
  the explicit form.
- Emitted C is unchanged from explicit record literals.
- Missing, duplicate, unknown, or mistyped fields keep existing diagnostics.

## Do

- Accept identifier fields without `:` inside record literals.
- Reuse existing resolver, checker, lowering, and emitter paths by producing an identifier
  expression for the field value.
- Add parser and compile tests.

## Do Not

- Do not add object spreads.
- Do not add computed property names.
- Do not add method properties, getters, setters, or JavaScript object behavior.

---

# Phase 35: TypeScript-Style Record Type Field Separators

Status: Complete.

## Goal

Accept TypeScript-style comma-separated record type fields, including no delimiter after the last
field.

## Syntax

```ts
type Point = {
  x: i32;
  y: i32;
};

type Size = { width: i32; height: i32 };
```

## Semantics

- Commas and semicolons are field separators only.
- Separator spelling does not affect type checking, lowering, or emitted C.
- Existing semicolon-separated record type fields remain valid.

## Do

- Accept `,` or `;` between record type fields.
- Accept an optional trailing comma or semicolon before `}`.
- Keep existing record field validation and C emission.
- Add parser and compile tests.

## Do Not

- Do not add optional record fields.
- Do not add readonly modifiers.
- Do not add index signatures, mapped types, or JavaScript object semantics.

---

# Phase 36: Parenthesized Type References

Status: Complete.

## Goal

Accept TypeScript-style parentheses around type references for grouping and readability.

## Syntax

```ts
function id(value: (i32)): (i32) {
  return value;
}

type Cell = { value: (i32), next: (i32)* };
function apply(cb: (value: i32) => i32, value: (i32)): i32 {
  return cb(value);
}
```

## Semantics

- Parentheses around a type reference are syntax only.
- `(T)` has the same type as `T`.
- Postfix type syntax applies to the grouped type, for example `(i32)*` is `i32*`.
- Function type syntax remains unchanged.

## Do

- Accept parenthesized type refs where type refs are accepted today.
- Preserve existing function type parsing for `(name: Type) => Return`.
- Reuse existing checker, lowering, and emitter behavior by returning the inner type ref with an
  expanded span.
- Add parser and compile tests.

## Do Not

- Do not add tuple types.
- Do not add function overload types.
- Do not add JavaScript runtime semantics.

---

# Phase 37: Named Import Aliases

Status: Complete.

## Goal

Accept TypeScript-style aliases in named imports while keeping imports fully static.

## Syntax

```ts
import { add as plus, sub } from "./math.tc";

function main(): i32 {
  return plus(2, sub(4, 1));
}
```

## Semantics

- `import { exported as local }` imports the exported symbol named `exported` and binds it locally
  as `local`.
- `import { name }` remains equivalent to `import { name as name }`.
- Duplicate local import names in one import list are rejected.
- Aliases are compile-time names only; no runtime object or dynamic lookup is created.
- Namespace imports remain unchanged.

## Do

- Parse named import specifiers with optional `as` aliases.
- Preserve existing named import behavior.
- Select imported exports by exported name, then expose aliased roots under the local name.
- Add parser, module loader, and compile tests.

## Do Not

- Do not add default imports.
- Do not add namespace alias changes.
- Do not add re-exports.
- Do not add JavaScript module runtime semantics.

---

# Phase 38: General Assignment Targets

Status: Complete.

## Goal

Allow assignments and statement-only updates to target static lvalues beyond simple local
identifiers.

## Syntax

```ts
x = value;
ship.x = ship.x + ship.vx;
items[i] = value;
items[i].alive = false;
ship.pos.x += dx;
items[i].count++;
```

## Semantics

- Assignment targets are static lvalues only.
- Valid targets are:
  - identifiers
  - field accesses whose operand is a valid assignable storage expression
  - index accesses whose operand is a valid assignable storage expression
  - nested combinations of field and index access
- `x op= y` is checked as `x = x op y` using existing operator rules.
- `++` and `--` remain statements only and require integer targets.
- Assignments remain statements only; no assignment expression values are added.
- `const` locals are not assignable, including through their fields or indexes.
- Whole fixed/inferred array variables are still not assignable, but their elements may be assigned.

## Do

- Parse assignment/update statements from expression lvalue targets.
- Type-check target mutability, lvalue shape, and assignability.
- Emit direct C lvalue assignments and updates.
- Add parser, checker, emitter, and compile tests.

## Do Not

- Do not add assignment expressions.
- Do not add destructuring assignment.
- Do not add logical/nullish assignment.
- Do not add pointer dereference assignment in this phase unless already represented as a valid
  emitted C lvalue by existing expression syntax.
- Do not add `for` loops, constructors, `implements`, or inheritance in this phase.

---

# Phase 39: Basic `for` Loops

Status: Complete.

## Goal

Add TypeScript/C-style counted `for` loops for explicit imperative iteration without introducing
JavaScript iterator semantics.

## Syntax

```ts
function sum(count: usize): i32 {
  let total: i32 = 0;
  for (let i: usize = 0; i < count; i++) {
    total += 1;
  }
  return total;
}
```

The initializer may be a local variable declaration, assignment/update statement, expression
statement, or empty. The condition is required and must be `bool`. The update may be an assignment,
`++`/`--`, expression statement, or empty.

## Semantics

- `for (init; condition; update) { body }` is equivalent to evaluating `init` once, then repeatedly
  evaluating `condition`, executing `body`, and evaluating `update` after each completed iteration.
- The initializer introduces a loop-local scope visible to the condition, update, and body, but not
  after the loop.
- The condition is statically checked as `bool`; TypeC does not use JavaScript truthiness.
- Assignment and update clauses reuse existing statement-only assignment/update rules.
- Emission uses a scoped C block plus `while` loop to preserve TypeC block scoping and existing
  defer behavior.

## Do

- Parse basic `for` headers with semicolon-separated initializer, condition, and update clauses.
- Support `let`/`const` initializer declarations.
- Type-check loop scopes, condition type, and update/initializer statements.
- Emit readable C.
- Add parser, checker, emitter, and compile tests.

## Do Not

- Do not add `for..in` or `for..of`.
- Do not add iterators or JavaScript collection semantics.
- Do not add `continue` in this phase.
- Do not make assignment an expression.

---

# Phase 40: Class `implements`

Status: Complete.

## Goal

Add TypeScript-style explicit static interface implementation declarations for classes.

## Syntax

```ts
interface Drawable {
  draw(): void;
}

class Ship implements Drawable {
  draw(): void {
    return;
  }
}
```

Multiple interfaces may be listed with commas:

```ts
class Ship implements Drawable, Updatable {
  draw(): void {
    return;
  }
  update(dt: f64): void {
    return;
  }
}
```

## Semantics

- `implements` is a compile-time contract only.
- A class satisfies an interface when it has every interface method with matching parameter count,
  parameter types, and return type.
- Instance receiver `this` is not written in interface method signatures.
- Generic class instantiations are checked after type substitution.
- `implements` does not create a value type, trait object, vtable, runtime dispatch, inheritance, or
  implicit conversion.

## Do

- Parse `class Name implements InterfaceName { ... }` and comma-separated interface lists.
- Check unknown interface names and missing/mismatched methods.
- Reuse existing interface/generic constraint structural method compatibility rules.
- Add parser and compile tests.

## Do Not

- Do not add runtime dispatch or vtables.
- Do not add interface-typed values.
- Do not add inheritance or `extends` for classes.
- Do not add constructors or `new`.

---

# Phase 41: Basic Constructors and `new`

Status: Complete.

## Goal

Add a small TypeScript-like constructor subset for structured class initialization while preserving
static value semantics and C emission.

## Syntax

```ts
class Point {
  x: i32;
  y: i32;

  constructor(x: i32, y: i32) {
    this.x = x;
    this.y = y;
  }
}

function main(): i32 {
  const p: Point = new Point(1, 2);
  return p.x;
}
```

## Semantics

- A class may declare at most one constructor.
- `new Class(args)` constructs and returns a class value; it does not allocate hidden heap memory.
- Constructor bodies execute with a mutable local `this` value initialized to zero, then return that
  value.
- Constructor arguments are checked against the constructor parameter list.
- Constructors are emitted as plain C helper functions returning the class record by value.

## Do

- Parse constructor declarations inside classes.
- Parse `new Class(args)` expressions.
- Type-check constructor calls, argument types, duplicate constructors, and unknown constructors.
- Emit value-returning C constructor helpers.
- Add parser and compile tests.

## Do Not

- Do not add heap allocation or garbage collection.
- Do not add `new` for non-class values.
- Do not add overloads, default parameters, parameter properties, access modifiers, `super`, or
  inheritance.
- Do not add JavaScript prototype semantics.

---

# Phase 42: Static Class Inheritance

Status: Complete.

## Goal

Add a narrow, static `extends` subset for class field/method reuse without JavaScript prototype
semantics or runtime dispatch.

## Syntax

```ts
class Entity {
  x: i32;
  move(dx: i32): void {
    this.x += dx;
  }
}

class Ship extends Entity {
  hp: i32;
}
```

## Semantics

- A class may extend one concrete class.
- Inherited fields are flattened into the child record layout before child fields.
- Inherited methods are copied for static dispatch on the child type unless the child declares a
  method with the same name.
- Child classes do not inherit constructors; each class still needs its own constructor for
  `new Class(...)`.
- There is no implicit subtype conversion from child to parent.
- There are no prototypes, vtables, virtual dispatch, `super`, protected/private access rules, or
  JavaScript runtime semantics.

## Do

- Parse `class Child extends Parent { ... }` and `class Child extends Parent implements I { ... }`.
- Reject unknown base classes and inheritance cycles.
- Flatten inherited fields and copy inherited methods during class lowering.
- Add parser and compile tests.

## Do Not

- Do not add runtime dispatch or vtables.
- Do not add `super`.
- Do not inherit constructors.
- Do not add implicit subtyping or interface values.
- Do not copy JavaScript prototype behavior.

---

# Phase 43: Optional Value Constructors

Status: Complete.

## Goal

Make optional values constructible without adding JavaScript `null` or `undefined` semantics.

## Syntax

```ts
const present: i32? = Some<i32>(42);
const empty: i32? = None<i32>();
```

## Semantics

- `Some<T>(value)` constructs a present optional value of type `T?`.
- `None<T>()` constructs an empty optional value of type `T?`.
- `Some` and `None` are compiler builtins, not ordinary functions and not runtime JS values.
- `Some<T>` takes exactly one value assignable to `T`.
- `None<T>` takes no arguments.
- The type argument is required. This phase does not add TypeScript-like inference for optional
  constructors.
- `T` must be a valid non-`void` value type.
- Emitted C uses the existing optional struct representation.

## Do

- Treat `Some` and `None` as resolver-recognized builtins.
- Type-check arity, required type arguments, and payload assignability.
- Emit optional compound literals.
- Add docs and tests.

## Do Not

- Do not add `null`, `undefined`, truthiness, or implicit optional conversions.
- Do not add optional constructor inference.
- Do not add optional parameters or optional object fields.

---

# Phase 44: `continue` Statements

Status: Complete.

## Goal

Add TypeScript/C-style `continue` for loops without adding labelled control flow or JavaScript
runtime semantics.

## Syntax

```ts
for (let i: usize = 0; i < count; i++) {
  if (skip(i)) {
    continue;
  }
  use(i);
}
```

## Semantics

- `continue` is valid only inside `while`, `do...while`, and basic `for` loops.
- In `while` and `do...while`, `continue` jumps to the next condition check.
- In `for`, `continue` runs the loop update clause before the next condition check.
- Existing `defer` cleanup for scopes exited by the jump must run in the correct order.

## Do Not

- Do not add labelled `continue`.
- Do not add `continue` for `switch` outside a loop.
- Do not change assignment/update expression rules.

---

# Phase 45: Static `for..of` over Arrays and Slices

Status: Complete.

## Goal

Add ergonomic value iteration for TypeC arrays and slices only, with no JavaScript iterator
protocol.

## Syntax

```ts
for (const value of values) {
  total += value;
}
```

Optional index binding may be considered only if explicitly specified before implementation.

## Semantics

- The iterable expression must be a fixed array, inferred local array, string array where valid, or
  `Slice<T>`.
- The loop lowers to an indexed counted loop using `.length()`/slice length and indexing.
- The loop variable is block-scoped and immutable for `const`, mutable for `let` if allowed by the
  final syntax.
- Iteration yields values by copy unless a later explicit reference-iteration syntax is specified.

## Do Not

- Do not add JavaScript `Symbol.iterator` or dynamic iterables.
- Do not add `for await`.
- Do not add mutation-during-iteration semantics beyond normal indexed loop behavior.

---

# Phase 46: Static `for..in` over Record Fields and Enum Members

Status: Complete.

## Goal

Add a constrained compile-time `for..in` form only where keys are statically known.

## Syntax

```ts
for (const key in point) {
  // key is a compile-time-known field name value or lowered branch selector
}
```

Record and class field keys are represented as immutable `u8*` C string pointers containing the
field name. Enum iteration yields enum member values with the enum type.

## Semantics

- `for..in` is allowed only over static record/class values or enum namespaces.
- Iterated keys are known at compile time from the type declaration.
- Record and class iteration lowers by unrolling the loop body once per field in declaration order.
- Enum iteration lowers by unrolling the loop body once per enum member in declaration order.
- Lowering must not require a dynamic object table or reflection runtime.
- Dynamic field access is not introduced in this phase.

## Do Not

- Do not copy JavaScript enumerable-property semantics.
- Do not include prototype keys, insertion order rules, symbols, or dynamic fields.
- Do not allow arbitrary dynamic object iteration.

---

# Phase 47: Tuple Types and Tuple Literals

Status: Complete.

## Goal

Add fixed-size positional product types with static element types.

## Syntax

```ts
const pair: [u8[], i32] = ["age", 42];
const name: u8[] = pair[0];
const age: i32 = pair[1];
```

## Semantics

- Tuple length and element types are part of the static type.
- Tuple indexes must be compile-time constants in range, unless a separate dynamic-index rule is
  specified.
- Lower to generated C structs with positional fields.
- Tuple fields are emitted as `_0`, `_1`, and so on.
- Tuples are value types with no JavaScript array methods or sparse elements.

## Do Not

- Do not add JS array holes.
- Do not add rest tuples or variadic tuple types in this phase.
- Do not add dynamic heterogeneous indexing without a clear result type.

---

# Phase 48: Static Record Spread and Rest

Status: Complete.

## Goal

Add TypeScript-like object spread/rest only for statically known record/class shapes.

## Syntax

```ts
const b: Point3 = { ...a, z: 3 };
const { x, ...rest } = point;
```

## Semantics

- Spread operands must have statically known record/class types.
- Field conflicts are resolved by explicit source order, matching TypeScript syntax where practical.
- The result type must be known from context or an explicitly specified static shape.
- Rest destructuring creates a statically known record value containing the remaining fields.
- Lowering emits direct field copies.
- Record literal duplicate/conflicting fields use source order, with the last applicable field value
  winning.

## Do Not

- Do not add dynamic property bags.
- Do not add computed property names in this phase.
- Do not add JavaScript enumerability, accessors, prototypes, or symbols.

---

# Phase 49: Static Template Literals

Status: Complete.

## Goal

Add backtick string syntax without JavaScript `String` objects or runtime dependency.

## Syntax

```ts
const name: u8[] = "TypeC";
const msg: u8[] = `hello ${name}`;
```

## Semantics

- Plain template literals without interpolation are string literals and may contain multiline
  content.
- Interpolated templates lower through compile-time string construction only.
- Supported interpolation forms are compile-time primitive literals and C string literals.
- Allocation strategy is compile-time only for constant expressions.
- Runtime interpolation is rejected until a fixed-buffer, arena, or caller-provided formatting
  facility is specified in a later phase.

## Do Not

- Do not add JavaScript `String` objects.
- Do not add implicit heap allocation.
- Do not add locale-sensitive or dynamic coercion semantics.

---

# Phase 50: TypeScript-Style Union Type Sugar

Status: Complete.

## Goal

Add `A | B` type syntax as static sugar over explicit TypeC tagged unions where layout and tags are
clear.

## Syntax

```ts
type Value = i32 | f64;
```

## Semantics

- Union types are closed, statically known sum types.
- Lowering produces the same tag-plus-payload representation as existing `union` forms.
- `type Value = i32 | f64;` lowers to a tagged union named `Value` with variants named after
  members.
- Construction and payload access use existing tagged union syntax, such as `Value.i32(1)` and
  `value.i32`.
- Optional `T?` remains the preferred spelling for `Optional<T>`.

## Do Not

- Do not add JavaScript runtime type coercion.
- Do not add implicit `null` or `undefined`.
- Do not add broad structural TS control-flow narrowing until specified.

---

# Phase 51: Intersection Types

Status: Complete.

## Goal

Add `A & B` as a static composition type for compatible record/interface shapes.

## Syntax

```ts
type Named = { name: u8[] };
type Aged = { age: i32 };
type Person = Named & Aged;
```

## Semantics

- Intersections over records/classes produce a statically known combined shape when fields are
  compatible.
- Intersections over interfaces require values/classes to satisfy all methods.
- Conflicting field names or incompatible method signatures are diagnostics.
- Lowering emits ordinary records or compile-time constraints; no runtime merge object is required.

## Do Not

- Do not add dynamic object mutation.
- Do not add impossible/`never`-heavy TypeScript edge cases in the first phase.
- Do not add prototype behavior.

---

# Phase 52: Conditional and Mapped Types

Status: Complete.

## Goal

Add a small compile-time-only type transformation subset after TypeC has enough type metadata to
make diagnostics predictable.

## Syntax

```ts
type Boxed<T> = { value: T };
type ReadonlyLike<T> = { [K in keyof T]: T[K] };
type IsI32<T> = T extends i32 ? true : false;
```

Initial supported syntax is non-distributive conditional type aliases of the form
`A extends B ? X : Y` and concrete mapped aliases of the form `{ [K in keyof T]: T[K] }` over
statically known record aliases.

## Semantics

- All evaluation happens at compile time.
- Mapped types operate only over statically known record/interface keys.
- Conditional types must avoid TypeScript distributive edge cases unless deliberately specified.
- Emitted C sees only the final concrete types.

## Do Not

- Do not add runtime reflection.
- Do not add arbitrary type-level computation without termination rules.
- Do not clone all TypeScript conditional-type behavior by default.

---

# Phase 53: Contextual Static Type Inference

Status: Complete.

## Goal

Reduce annotation noise by inferring types whenever a unique static type is available from local
syntax or surrounding context, while keeping TypeC predictable and diagnostics clear.

## Syntax Examples

```ts
let count = 0; // inferred from initializer/context
const p: Point = { x: 1, y: 2 }; // record literal fields inferred from assigned type
const values: i32[] = [1, 2, 3]; // array literal elements inferred from assigned type

function apply(cb: (x: i32) => i32): i32 {
  return cb(1);
}

apply((x) => x + 1); // callback parameter/result inferred from expected function type

function add(a: i32, b: i32) {
  return a + b; // return type inferred as i32 when unambiguous
}

const value: i32 = identity(42); // generic type args inferred from args/assigned result type
```

## Scope Candidates

Completed subset: local `const`/`let` variable types from unique primitive, named, optional,
non-empty fixed array, and simple record initializer types; contextual non-empty array literals for
array and slice targets; non-capturing expression-bodied parenthesized and single-param arrow
callbacks from expected function types; optional constructor type arguments from assigned/contextual
optional types; generic call type arguments from ordinary literal/unary literal/binary
literal/conditional literal/nullish literal/optional constructor/string literal/array/local
identifier/global callback identifier/typed and inferred callback local/record-field/typed call
arguments, including callback fields of inferred simple-record locals, callback elements of inferred
fixed-array locals, callback elements of typed tuple locals, non-null-asserted optional arguments,
dereferenced pointer and address-of reference arguments, fields of inferred simple-record and named
locals, assigned result types, return types, function/method parameter contexts, record/array/tuple
literal expected contexts, conditional expression contexts, nullish fallback contexts, and
identifier/record-field/index assignment target contexts; generic class constructor `new` type
arguments from assigned variable types, return types, function parameter contexts,
record/array/tuple literal expected contexts, conditional expression contexts, nullish fallback
contexts, identifier/record-field/index assignment target contexts, and ordinary literal/unary
literal/binary literal/conditional literal/nullish literal/string literal/array/simple-record/local
identifier/record-field/index/generic-class-field/typed-call/non-null-asserted optional/dereferenced
pointer/address-of reference constructor arguments; non-exported function return types from
unambiguous return statements.

- Local variable types from initializers.
- Expression types from assigned/contextual types.
- Record literal field types from expected record/struct/class type.
- Array literal element types from expected array/slice type.
- Callback parameter and result types from expected function type.
- Function return types from complete return statements.
- Generic call type arguments from ordinary arguments.
- Generic call type arguments from expected/assigned result type.
- Constructor/generic class type arguments from arguments and assigned type.
- Optional constructor type arguments from assigned type, for example `None()` in `const x: i32?`.

## Semantics

- Inference is compile-time only and must not change runtime representation.
- Assigned/contextual types flow inward to expressions only when the expected type is unique.
- Inferred result types must be stable and ABI-clear before exported APIs may omit annotations.
- Public exported APIs may still require explicit annotations unless a stable rule is specified.
- Ambiguous, lossy, or cyclic inference should produce clear diagnostics instead of guessing.
- Integer and float literals may be inferred from context; without context they use TypeC's existing
  explicit literal/default rules.

## Do

- Prefer local, syntax-directed inference over global whole-program guessing.
- Keep diagnostics pointing to the missing/ambiguous annotation or expression.
- Add checker tests for assigned type, parameter context, callback context, return inference, and
  generic result inference.

## Do Not

- Do not infer `any`.
- Do not add JavaScript widening rules such as general `number`.
- Do not hide ABI-relevant types in exported C interop boundaries.
- Do not infer through runtime control flow in a way that changes emitted representation.

---

# Phase 54: Plain `struct` Declarations

Status: Complete.

## Goal

Separate plain data records from object-like classes. `struct` is the simple C-shaped data form and
has no methods.

## Syntax

```ts
struct Vec2 {
  x: f32;
  y: f32;
}

function lengthSquared(v: Vec2): f32 {
  return v.x * v.x + v.y * v.y;
}
```

## Semantics

- `struct Name { fields }` declares a plain value type with C-compatible field layout.
- Struct fields use the same static field typing rules as record type aliases.
- Structs do not contain methods, constructors, inheritance, `implements`, vtables, or runtime type
  metadata.
- Struct values use existing `let`/`const` binding mutability rules.
- Lowering emits an ordinary C `typedef struct`.
- Existing record type aliases may remain valid; this phase adds an explicit nominal data keyword.

## Do

- Parse `struct` declarations with fields only.
- Reject methods and constructors inside structs.
- Reuse record field checking and C emission where possible.
- Add parser, checker, emitter, and compile tests.

## Do Not

- Do not add struct methods.
- Do not add struct inheritance or interfaces.
- Do not add hidden metadata or vtables to structs.

---

# Phase 55: Static Class VTables

Status: Complete.

## Goal

Lower class methods through generated per-class vtables while preserving static dispatch. This gives
classes an object-table shape without adding dynamic dispatch yet.

## Syntax

```ts
class Circle {
  radius: f32;

  draw(): void {
    return;
  }

  size(): f32 {
    return this.radius * this.radius;
  }
}

function main(): i32 {
  let circle: Circle = { radius: 2.0 };
  circle.draw();
  return 0;
}
```

## Lowering Model

A class lowers to a data struct, a vtable struct, method functions, and one global vtable instance:

```c
typedef struct {
  f32 radius;
} Circle;

typedef struct {
  void (*draw)(Circle* self);
  f32 (*size)(Circle* self);
} CircleVTable;

void Circle_draw(Circle* self) {
  return;
}

f32 Circle_size(Circle* self) {
  return self->radius * self->radius;
}

const CircleVTable vCircle = {
  .draw = Circle_draw,
  .size = Circle_size,
};
```

A concrete method call:

```ts
circle.draw();
```

lowers statically to:

```c
vCircle.draw(&circle);
```

## Semantics

- Class methods are represented as entries in a generated `ClassNameVTable`.
- Each class has one generated global vtable instance, for example `vCircle`.
- Method calls still dispatch statically from the receiver's known concrete type.
- The vtable is not stored in each object in this phase.
- There are no interface values, fat pointers, runtime type objects, or virtual override selection.
- Method receivers are lowered as pointers so methods can observe and update the receiver when the
  source mutability rules allow it.
- Constructors initialize and return the plain class data struct; they do not allocate.

## Do

- Generate one vtable struct per class containing method function pointers.
- Generate one global vtable value per class.
- Lower `obj.method(args)` to `vClass.method(&obj, args)` for concrete class receivers.
- Preserve existing static `implements` checks as compile-time validation only.
- Add emitter tests showing the generated data struct, vtable struct, vtable instance, and call
  lowering.

## Do Not

- Do not add dynamic dispatch.
- Do not add `dyn Interface` values.
- Do not add object-embedded vptr fields.
- Do not add hidden heap allocation, GC, prototypes, or implicit subtype conversion.

---

# Phase 56: Default and Optional Parameters

Status: Complete.

## Goal

Add TypeScript-like parameter convenience while keeping call lowering static.

## Syntax

```ts
function move(dx: i32 = 1, dy: i32 = 0): void {}
function log(value: i32, prefix?: u8[]): void {}
```

## Semantics

- Default parameter expressions are evaluated at the call site or through generated wrapper helpers;
  the final lowering must be specified before implementation.
- Optional parameters lower to explicit optional values or generated overload wrappers.
- Parameter defaults must be type checked against the parameter type.
- Defaults cannot depend on JavaScript `undefined`.

## Do Not

- Do not add implicit `undefined`.
- Do not add runtime argument-count reflection.
- Do not add dynamic dispatch.

---

# Phase 57: Function Overload Declarations

Status: Complete.

## Goal

Add TypeScript-style overload declarations resolved completely at compile time.

## Syntax

```ts
function read(x: i32): i32;
function read(x: u8[]): i32;
function read(x: i32 | u8[]): i32 {
  return 0;
}
```

## Semantics

- Overload selection is based on static argument types.
- Emitted C must have unambiguous generated function names or wrapper functions.
- Ambiguous calls are diagnostics.

## Do Not

- Do not add runtime overload resolution.
- Do not add JS coercion-based overload matching.

---

# Phase 58: Destructuring Bindings

Status: Complete.

## Goal

Add ergonomic static destructuring for records, structs, tuples, and arrays where shapes are known.

## Syntax

```ts
const { x, y } = point;
const [a, b] = pair;
```

## Semantics

- Object destructuring requires statically known fields.
- Array/tuple destructuring requires statically known indexes and compatible element types.
- Rest destructuring reuses the static record/tuple rest rules once those phases exist.
- Lowering emits ordinary local declarations and field/index reads.

## Do Not

- Do not add dynamic property lookup.
- Do not add JS iterator destructuring.
- Do not add sparse array holes.

---

# Phase 59: Access Modifiers and `readonly`

Status: Complete.

## Goal

Add compile-time visibility and immutability annotations.

## Syntax

```ts
class Counter {
  private value: i32;
  public get(): i32 {
    return this.value;
  }
}

type Vec2 = { readonly x: f32; readonly y: f32 };
```

## Semantics

- `public`, `private`, and `protected` are checked at compile time only.
- Class field and method access is validated from the statically known receiver type.
- `readonly` class and record fields cannot be assigned after initialization.
- Emitted C layout is unchanged.

## Do Not

- Do not add JS private field runtime semantics.
- Do not add reflection of access modifiers.

---

# Phase 60: Static Class Members

Status: Complete.

## Goal

Add TypeScript-like `static` fields and methods as namespaced class members.

## Syntax

```ts
class MathUtil {
  static zero: i32 = 0;

  static abs(x: i32): i32 {
    return x < 0 ? -x : x;
  }
}

const x: i32 = MathUtil.abs(-1) + MathUtil.zero;
```

## Semantics

- Static methods lower to ordinary namespaced functions.
- Static fields lower to compile-time constants.
- Static members do not require an object instance.
- Static methods must be called through the class name, not an instance value.

## Do Not

- Do not add JS constructor objects.
- Do not add dynamic static property mutation.

---

# Phase 61: Namespaces

Status: Complete.

## Goal

Add static namespace declarations for grouping declarations without a JavaScript module object.

## Syntax

```ts
namespace Math {
  export function abs(x: i32): i32 {
    return x < 0 ? -x : x;
  }
}
```

## Semantics

- Namespaces are compile-time declaration groups.
- Qualified names lower to unique C symbols.
- No runtime namespace object is emitted unless explicitly required for C interop.

## Do Not

- Do not add dynamic namespace mutation.
- Do not add JS namespace/module merging until specified.

---

# Phase 62: Type-Only Imports, Re-exports, and Default Imports

Status: Complete.

## Goal

Improve module ergonomics while preserving static module loading.

## Syntax

```ts
import type { Vec2 } from "./vec.tc";
export type { Vec2 };
export { add } from "./math.tc";
import MainThing from "./thing.tc";
```

## Semantics

- Type-only imports are erased after checking.
- Re-exports are compile-time module forwarding.
- Default imports/exports are aliases to one statically known exported declaration.

## Do Not

- Do not add dynamic import.
- Do not add CommonJS or JS module runtime semantics.

---

# Phase 63: Enum Improvements

Status: Complete.

## Goal

Make enums more TypeScript-like while keeping representation explicit.

## Scope

- Explicit backing types: `enum Color: u8 { Red, Green }`.
- Explicit member initializers with range checks.

## Do Not

- Do not add JS enum reverse-mapping objects.
- Do not add runtime reflection by default.

---

# Phase 64: Literal Types and Const Narrowing

Status: Complete.

## Goal

Track literal values in the type checker where useful for diagnostics, overloads, and type-level
features.

## Syntax

```ts
const answer = 42;
type Mode = "read" | "write";
```

## Semantics

- Literal types are compile-time facts only.
- Numeric literal types must still map to explicit machine types before C emission.
- Const narrowing must not create JavaScript `number`/`string` semantics.

## Do Not

- Do not add boxed string/number values.
- Do not add runtime type tags for ordinary literals.

---

# Phase 65: Checked Numeric Casts with `as` and `@T(expr)`

Status: Complete.

## Goal

Add explicit checked numeric cast syntax without JavaScript runtime coercions.

## Syntax

```ts
const width: i32 = 1280;
const wf: f32 = @f32(width);
const truncated: i32 = value as i32;
```

## Semantics

- `@T(expr)` and `expr as T` are equivalent explicit cast forms.
- This phase permits numeric casts only: integer ↔ integer, integer ↔ float, and float ↔ float.
- Cast targets are normal TypeC type refs and are validated before emission.
- Lowering emits C casts only after type checking approves the conversion category.

Pointer casts, enum backing casts, ABI reinterpretation, and unsafe casts are reserved for later
phases with explicit safety rules.

## Do Not

- Do not make `as` a way to bypass all type checking silently.
- Do not add JS runtime coercions.
- Do not allow record, class, array, optional, or pointer casts in this phase.

---

# Phase 66: `satisfies`

Status: Complete.

## Goal

Add compile-time conformance checking without changing the expression's inferred type.

## Syntax

```ts
const config = value satisfies Config;
```

## Semantics

- The left expression is checked as assignable/conformant to the right type.
- The expression keeps its original static type.
- No C code is emitted for the `satisfies` operator itself.

## Do Not

- Do not add runtime validation.
- Do not change object layout.

---

# Phase 67: `keyof` and Type-Position `typeof`

Status: Complete.

## Goal

Add small compile-time type reflection features over statically known declarations.

## Syntax

```ts
type Keys = keyof Point;
type ValueType = typeof value;
```

## Semantics

- `keyof` works over records, structs, classes, interfaces, and namespaces where keys are static.
- Type-position `typeof` extracts the compile-time type of a value symbol or expression if allowed.
- Both features are erased before C emission.

## Do Not

- Do not add runtime reflection.
- Do not add JavaScript `typeof` expression semantics in this phase.

---

# Phase 68: Tagged Union Narrowing and Pattern Matching

Status: Complete.

## Goal

Make existing tagged unions feel ergonomic and safe.

## Syntax Candidates

```ts
if (value.tag == MaybeI32.Some) {
  return value.Some;
}

match (value) {
  Some(v) => return v;
  None => return 0;
}
```

## Semantics

- Narrowing is based on explicit tag checks or `match` arms.
- Payload access is only allowed when the active variant is known.
- Exhaustiveness checking should be added for `match`.

## Do Not

- Do not add JS `instanceof` semantics.
- Do not add dynamic type tests unrelated to tagged union tags.

---

# Phase 69: Module and Package Ergonomics

Status: Complete.

## Goal

Improve project-scale TypeC workflows.

## Scope Candidates

- Barrel files through static re-exports.
- Package aliases beyond single-project dependencies.
- Cleaner standard-library import conventions.
- Package metadata and versioning if needed.

## Do Not

- Do not add runtime module loading.
- Do not add URL/network imports unless security rules are specified.

---

# Phase 70: Formatter

Status: Complete.

## Goal

Add an official formatter for `.tc` files.

## Semantics

- Formatting changes syntax layout only.
- Formatter must preserve comments and produce stable output.

---

# Phase 71: Rich LSP Tooling

Status: Complete.

## Goal

Make TypeC feel productive in editors.

## Scope Candidates

- Semantic diagnostics.
- Hover type information.
- Completion.
- Go-to-definition.
- Rename.
- Find references.
- Code actions and quick fixes.
- Formatting integration.

## Do Not

- Do not make LSP behavior depend on a runtime execution environment.
- Do not allow editor tooling to accept programs the compiler rejects.

---

# Phase 72: Compiler Check Command

Status: Complete.

## Goal

Provide a fast command for syntax, module resolution, and semantic validation without C emission or
native compilation.

## Syntax

```bash
STC check path/to/file.tc
```

## Semantics

- Load the same project configuration and imports as normal compilation.
- Run the same parser, resolver, generic instantiation, and checker as normal compilation.
- Do not emit C files.
- Do not require a `main` function.
- Print a short success message only when validation succeeds.

## Do Not

- Do not accept programs rejected by `build` or `run`.
- Do not execute generated code.
- Do not perform native compilation.

---

# Phase 73: Configurable Build Directory

Status: Complete.

## Goal

Allow project scripts to choose where generated C and native outputs are written.

## Syntax

```bash
STC build path/to/file.tc --build-dir out
STC run path/to/file.tc --build-dir out
```

## Semantics

- `--build-dir` applies only to commands that write compiler build artifacts.
- The default build directory remains `build`.
- The selected directory is created when needed.
- Output file names remain derived from the input file basename.

## Do Not

- Do not change import resolution.
- Do not change generated C semantics.
- Do not require `--build-dir` for existing commands.

---

# Phase 74: Source Artifact Clean Command

Status: Complete.

## Goal

Remove generated build artifacts for a TypeC source file without parsing, compiling, or executing
it.

## Syntax

```bash
STC clean path/to/file.tc
STC clean path/to/file.tc --build-dir out
```

## Semantics

- Remove the generated C file and native executable path derived from the input file basename.
- Use the same default build directory as compilation: `build`.
- Ignore already-missing artifacts.
- Print a short success message when cleanup completes.

## Do Not

- Do not delete source files.
- Do not delete import dependencies.
- Do not recursively delete the build directory.
- Do not parse or type-check the source as part of cleaning.

---

# Phase 75: Compiler Version Command

Status: Complete.

## Goal

Expose the TypeC compiler version through a command that does not require a source file.

## Syntax

```bash
STC version
```

## Semantics

- Print the compiler name and version.
- Do not read source files.
- Do not read project configuration.
- Do not compile, run, format, or clean artifacts.

## Do Not

- Do not infer the language version from host runtime metadata.
- Do not require network or package-manager access.

---

# Phase 76: Compiler Help Command

Status: Complete.

## Goal

Expose command-line usage through a command that does not require a source file.

## Syntax

```bash
STC help
```

## Semantics

- Print the compiler usage text.
- Do not read source files.
- Do not read project configuration.
- Do not compile, run, format, clean, or start the LSP server.

## Do Not

- Do not introduce shell-specific behavior.
- Do not add dynamic command discovery.

---

# Phase 77: Formatter Check Command

Status: Complete.

## Goal

Allow tooling and CI to verify formatter output without modifying source files.

## Syntax

```bash
STC fmt-check path/to/file.tc
```

## Semantics

- Read one TypeC source file.
- Format the source using the same formatter as `STC fmt`.
- Succeed when the file already matches formatted output.
- Fail when the file would change.
- Do not write source files.
- Do not parse, type-check, compile, run, or clean artifacts.

## Do Not

- Do not add recursive directory formatting.
- Do not add project-wide formatting.
- Do not introduce formatter options.

---

# Phase 78: No-Artifact C Emission Command

Status: Complete.

## Goal

Make the C emission inspection command write only to standard output.

## Syntax

```bash
STC emit-c path/to/file.tc
```

## Semantics

- Read and validate one TypeC source file through the normal compiler pipeline.
- Print emitted C to standard output.
- Do not create build directories.
- Do not write `.c` files.
- Do not compile native executables.
- Do not require `main`.

## Do Not

- Do not change `STC build` or `STC run` artifact behavior.
- Do not add alternate C output paths.
- Do not skip type checking before emission.

---

# Phase 79: Syntax Parse Command

Status: Complete.

## Goal

Expose a fast syntax-only validation command for editors and scripts.

## Syntax

```bash
STC parse path/to/file.tc
```

## Semantics

- Read one TypeC source file.
- Run lexing and parsing only.
- Succeed when the file is syntactically valid.
- Print `Parsed <file>` on success.
- Do not load project configuration.
- Do not resolve imports.
- Do not type-check.
- Do not emit C, compile, run, format, or clean artifacts.

## Do Not

- Do not accept programs rejected by the parser.
- Do not perform semantic validation.
- Do not require `main`.

---

# Phase 80: Standard CLI Help and Version Flags

Status: Complete.

## Goal

Support conventional command-line flag forms for help and version queries.

## Syntax

```bash
STC --help
STC --version
```

## Semantics

- `--help` behaves exactly like `STC help`.
- `--version` behaves exactly like `STC version`.
- Neither flag accepts a source file or extra arguments.
- Do not read source files.
- Do not read project configuration.
- Do not compile, run, format, clean, parse, emit AST, emit C, or start the LSP server.

## Do Not

- Do not add short flags.
- Do not add global option parsing for other commands.
- Do not accept combined flags.

---

# Phase 81: Build Directory Option Validation

Status: Complete.

## Goal

Reject empty build artifact directory arguments before any command runs.

## Syntax

```bash
STC build path/to/file.tc --build-dir out
STC run path/to/file.tc --build-dir out
STC clean path/to/file.tc --build-dir out
```

## Semantics

- `--build-dir` remains valid only for `build`, `run`, and `clean`.
- The `--build-dir` value must be non-empty text.
- An empty `--build-dir` value is a CLI parse error.
- Validation happens before reading source files or deleting artifacts.

## Do Not

- Do not normalize or canonicalize build directory paths in CLI parsing.
- Do not reject platform-specific path spellings.
- Do not change the default build directory.

---

# Phase 82: CLI TypeC Source Extension Validation

Status: Complete.

## Goal

Reject command-line source inputs that are not TypeC source files.

## Syntax

```bash
STC build path/to/file.tc
STC check path/to/file.tc
STC parse path/to/file.tc
STC fmt path/to/file.tc
```

## Semantics

- Commands that take a source file require an input path ending in `.tc`.
- Validation happens during CLI parsing.
- Invalid source extension inputs are CLI parse errors.
- Validation does not check whether the file exists.
- Commands without source files are unchanged.

## Do Not

- Do not validate import paths in CLI parsing.
- Do not canonicalize source paths.
- Do not add support for alternate source extensions.

---

# Phase 83: Formatted Syntax Command Diagnostics

Status: Complete.

## Goal

Use the same formatted diagnostic output for syntax-only driver commands as compiler commands.

## Syntax

```bash
STC parse path/to/file.tc
STC emit-ast path/to/file.tc
```

## Semantics

- Parser diagnostics are printed with file path and source location context.
- Syntax command failures exit with a non-zero status.
- No stack trace is printed for TypeC syntax diagnostics.
- `STC parse` remains lexing and parsing only.
- `STC emit-ast` remains lexing and parsing only.

## Do Not

- Do not add semantic validation to syntax commands.
- Do not load project configuration.
- Do not resolve imports.

---

# Phase 84: Complete CLI Usage Text

Status: Complete.

## Goal

Keep the command-line usage text accurate for all implemented commands and standard flags.

## Syntax

```bash
STC help
STC --help
```

## Semantics

- Help output lists every supported top-level command.
- Help output lists `--help` and `--version` flag aliases.
- Help output shows `--build-dir` only for commands that accept it.
- Help output remains static text and does not inspect project files.

## Do Not

- Do not add new CLI commands.
- Do not add short flags.
- Do not add a global flag parser.

---

# Phase 85: CLI Parse Error Reasons

Status: Complete.

## Goal

Report a concise reason when CLI argument parsing fails.

## Syntax

```bash
STC build
STC build main.txt
STC check main.tc --build-dir out
```

## Semantics

- Invalid CLI requests print one short error line before usage text.
- CLI parsing exposes structured parse errors for tests and tools.
- Existing command behavior remains unchanged for valid requests.
- Source path validation remains suffix-only.
- Build directory validation remains syntactic only.

## Do Not

- Do not add new commands or options.
- Do not add short flags.
- Do not inspect files or project configuration during CLI parsing.

---

# Phase 86: Source File Read Diagnostics

Status: Complete.

## Goal

Report concise source file read errors for source-taking driver commands.

## Syntax

```bash
STC check missing.tc
STC parse missing.tc
STC fmt missing.tc
```

## Semantics

- Missing source files produce a short driver error without a stack trace.
- Unreadable source files produce a short driver error without a stack trace.
- CLI parsing still does not inspect the filesystem.
- `STC clean` remains artifact-only and does not read the source file.

## Do Not

- Do not add semantic validation to parse-only commands.
- Do not canonicalize source paths during CLI parsing.
- Do not change build artifact paths.

---

# Phase 87: Formatter Change Reporting

Status: Complete.

## Goal

Expose whether formatter commands changed source text.

## Syntax

```bash
STC fmt path/to/file.tc
STC fmt-check path/to/file.tc
```

## Semantics

- Formatting a source file returns whether the file content changed.
- Already formatted files are not rewritten by `STC fmt`.
- `STC fmt` still produces no output on success.
- `STC fmt-check` behavior is unchanged.

## Do Not

- Do not change formatter layout rules.
- Do not add formatter configuration.
- Do not inspect project configuration.

---

# Phase 88: Specific Build Directory CLI Diagnostics

Status: Complete.

## Goal

Report precise CLI errors for invalid `--build-dir` usage.

## Syntax

```bash
STC build main.tc --build-dir ""
STC check main.tc --build-dir out
STC run main.tc --bad out
```

## Semantics

- Empty `--build-dir` values report that the build directory must not be empty.
- Commands that do not accept `--build-dir` report that the option is not accepted.
- Unknown source command options continue to report an invalid option.
- Valid build directory behavior is unchanged.

## Do Not

- Do not add new options.
- Do not canonicalize or normalize build directory paths.
- Do not inspect the filesystem during CLI parsing.

---

# Phase 89: Clean Command Removal Reporting

Status: Complete.

## Goal

Expose which generated artifacts were removed by the clean driver path.

## Syntax

```bash
STC clean path/to/file.tc
STC clean path/to/file.tc --build-dir out
```

## Semantics

- Clean returns the generated artifact paths it removed.
- Missing generated artifacts are ignored and are not reported as removed.
- CLI success output remains `Cleaned <file>`.
- Clean remains artifact-only and does not read or parse the source file.

## Do Not

- Do not delete build directories.
- Do not parse or type-check source files.
- Do not change generated artifact path rules.

---

# Phase 90: Watch Build Directory Option

Status: Complete.

## Goal

Allow watched builds to use the same configurable build directory as one-shot native builds.

## Syntax

```bash
STC watch path/to/file.tc
STC watch path/to/file.tc --build-dir out
```

## Semantics

- `watch` accepts `--build-dir <dir>`.
- The default watched build directory remains `build`.
- Watched rebuilds write generated artifacts into the selected build directory.
- Build directory validation is the same as `build`, `run`, and `clean`.

## Do Not

- Do not add recursive project watching.
- Do not change watched event filtering.
- Do not change import resolution or C semantics.

---

# Phase 91: Native Compiler Launch Diagnostics

Status: Complete.

## Goal

Report concise diagnostics when the native C compiler process cannot be launched.

## Syntax

```bash
STC build path/to/file.tc
STC run path/to/file.tc
STC watch path/to/file.tc
```

## Semantics

- If the native compiler executable cannot be found, the driver prints a short error without a stack
  trace.
- Native compiler stderr is still printed when the compiler process runs and reports failure.
- The native compiler command remains `cc`.
- C emission and TypeC semantic checking are unchanged.

## Do Not

- Do not add compiler command configuration.
- Do not add platform-specific compiler probing.
- Do not change generated C.

---

# Phase 92: Native Executable Launch Diagnostics

Status: Complete.

## Goal

Report concise diagnostics when a built executable cannot be launched by `run`.

## Syntax

```bash
STC run path/to/file.tc
```

## Semantics

- If the built executable cannot be started, the driver prints a short error without a stack trace.
- If the executable starts, its stdin, stdout, stderr, and exit code behavior remain unchanged.
- Build and C emission semantics are unchanged.

## Do Not

- Do not add process supervision.
- Do not add shell execution.
- Do not change executable naming or build artifact paths.

---

# Phase 93: LSP Hover

Status: Complete.

## Goal

Provide useful hover text for TypeC source symbols in open editor documents.

## Syntax

```ts
function main(): i32 {
  return 0;
}
```

## Semantics

- `textDocument/hover` returns hover content for the token under the requested position.
- Hover covers TypeC keywords, primitive types, and top-level declaration names.
- Hover uses currently opened document text only.
- Hover does not change compiler semantics, diagnostics, formatting, completion, or emitted C.
- Unknown positions return `null`.

## Do Not

- Do not add cross-file symbol indexing.
- Do not add go-to-definition, references, rename, semantic tokens, or code actions in this phase.
- Do not infer runtime JavaScript behavior.

---

# Phase 94: LSP Go-to Definition

Status: Complete.

## Goal

Navigate from a TypeC identifier in an open document to its local or top-level definition.

## Syntax

```ts
function helper(): i32 {
  return 1;
}

function main(): i32 {
  return helper();
}
```

## Semantics

- `textDocument/definition` returns the definition location for the identifier under the requested
  position.
- Definitions include top-level declarations and function parameters/local bindings in the current
  opened document.
- Unknown positions or unknown symbols return `null`.
- This phase is single-document only.
- Diagnostics, formatting, completion, hover, and emitted C are unchanged.

## Do Not

- Do not add cross-file navigation.
- Do not add references, rename, semantic tokens, or code actions in this phase.
- Do not add a new compiler semantic model for LSP.

---

# Phase 95: LSP Find References

Status: Complete.

## Goal

Find same-document TypeC identifier references for the symbol under the cursor.

## Semantics

- `textDocument/references` returns same-document locations for matching identifier tokens.
- When requested, declarations are included according to the LSP request flag.
- Cross-file references are not included.

## Do Not

- Do not add project-wide indexing.
- Do not implement rename in this phase.

---

# Phase 96: LSP Rename

Status: Complete.

## Goal

Rename a same-document TypeC symbol safely enough for editor use.

## Semantics

- `textDocument/rename` returns a workspace edit for same-document identifier occurrences.
- Rename rejects non-identifier positions.
- Rename does not cross file boundaries.

## Do Not

- Do not rename inside string literals or comments.
- Do not add project-wide edits.

---

# Phase 97: LSP Semantic Tokens

Status: Complete.

## Goal

Provide semantic token data for TypeC syntax highlighting.

## Semantics

- `textDocument/semanticTokens/full` returns full-document semantic token data.
- Tokens cover keywords, types, functions, variables, properties, strings, numbers, and operators
  where statically known from the open document.

## Do Not

- Do not require compiler emission.
- Do not add partial/delta semantic tokens.

---

# Phase 98: LSP Code Actions

Status: Complete.

## Goal

Provide small editor code actions for TypeC diagnostics and formatting-oriented fixes.

## Semantics

- `textDocument/codeAction` returns available source actions for the requested range.
- Initial actions are limited to safe, single-document edits.

## Do Not

- Do not add speculative fixes that change program meaning.
- Do not add cross-file refactors.

---

# Phase 99: LSP Document Symbols

Status: Complete.

## Goal

Expose same-document TypeC declarations to editor outline and symbol navigation views.

## Semantics

- `textDocument/documentSymbol` returns symbols for declarations in the opened document.
- Symbols include top-level declarations, function parameters, and local bindings known from lexical
  structure.
- The response is single-document only.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens, code
  actions, and emitted C are unchanged.

## Do Not

- Do not add workspace symbol search.
- Do not add cross-file indexing.
- Do not infer runtime JavaScript behavior.

---

# Phase 100: LSP Prepare Rename

Status: Complete.

## Goal

Let editors validate rename positions before applying `textDocument/rename`.

## Semantics

- `textDocument/prepareRename` returns the identifier range and placeholder for known same-document
  symbols.
- It returns `null` for whitespace, non-identifiers, and unknown identifiers.
- It uses the same symbol scope model as same-document rename.
- Diagnostics, formatting, completion, hover, definition, references, rename edits, semantic tokens,
  code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file rename preparation.
- Do not add speculative parser recovery.
- Do not change actual rename edit generation.

---

# Phase 101: LSP Signature Help

Status: Complete.

## Goal

Show TypeC function call signatures while editing calls.

## Semantics

- `textDocument/signatureHelp` returns same-document function signatures for calls at the cursor.
- Signature labels use the declared function name, parameter labels, and return type text.
- Active parameter is selected from top-level commas inside the active call argument list.
- It returns `null` outside known same-document function calls.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens, code
  actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add overload resolution.
- Do not add cross-file signature lookup.
- Do not type-check arguments in the LSP helper.

---

# Phase 102: LSP Document Highlights

Status: Complete.

## Goal

Highlight same-document symbol occurrences when the cursor is on a known TypeC identifier.

## Semantics

- `textDocument/documentHighlight` returns ranges for same-document references of the selected
  symbol.
- Highlights include the declaration and all identifier-token references known by the same symbol
  model used for definition, references, rename, and prepare rename.
- It returns an empty list for whitespace, non-identifiers, and unknown identifiers.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file highlights.
- Do not highlight comments or strings.
- Do not add semantic write/read classification yet.

---

# Phase 103: LSP Folding Ranges

Status: Complete.

## Goal

Expose safe same-document folding ranges for TypeC block structure.

## Semantics

- `textDocument/foldingRange` returns foldable ranges for matched `{ ... }` blocks in the opened
  document.
- Folding ranges are derived from lexer tokens only.
- Only multi-line matched brace blocks are returned.
- Unmatched braces are ignored.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, document highlights, code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add comment folding.
- Do not add region pragmas.
- Do not parse or type-check for folding ranges.

---

# Phase 104: LSP Selection Ranges

Status: Complete.

## Goal

Expose safe same-document selection expansion ranges for TypeC editors.

## Semantics

- `textDocument/selectionRange` returns one selection range tree for each requested cursor position.
- The innermost range is the lexer token at the cursor.
- Parent ranges are enclosing matched `{ ... }` blocks, ordered from inner to outer.
- Positions outside tokens return no selection range entry.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, document highlights, folding ranges, code actions, document symbols, and emitted C
  are unchanged.

## Do Not

- Do not parse or type-check for selection ranges.
- Do not add cross-file behavior.
- Do not include comments or whitespace ranges yet.

---

# Phase 105: LSP Workspace Symbols

Status: Complete.

## Goal

Expose same-document TypeC declarations through the LSP workspace symbol request for editors that
use workspace search UI.

## Semantics

- `workspace/symbol` searches declarations in currently opened documents only.
- Matching is case-sensitive substring matching on symbol names.
- Empty query returns all known opened-document symbols.
- Results use flat `SymbolInformation` records with source URI and declaration range.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, document highlights, folding ranges, selection ranges, code actions, document
  symbols, and emitted C are unchanged.

## Do Not

- Do not scan the filesystem.
- Do not index unopened files.
- Do not add cross-file semantic resolution.

---

# Phase 106: LSP Document Links

Status: Complete.

## Goal

Expose static TypeC import paths as editor document links.

## Semantics

- `textDocument/documentLink` returns links for import string literals in the opened document.
- Links are single-document and derived from lexer tokens only.
- Relative import targets are resolved against the current document URI.
- Non-relative import targets are returned as their literal import text.
- Invalid target URI construction omits the link target.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, document highlights, folding ranges, selection ranges, workspace symbols, code
  actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not scan the filesystem.
- Do not validate import existence.
- Do not add cross-file semantic resolution.

---

# Phase 107: LSP Inlay Hints

Status: Complete.

## Goal

Expose safe same-document inlay hints for TypeC call arguments.

## Semantics

- `textDocument/inlayHint` returns parameter-name hints for direct calls to functions declared in
  the same opened document.
- Hints are derived from lexer tokens only.
- A call argument receives a hint when the matching function parameter has an identifier name.
- Hints use LSP parameter hint kind and appear at the argument start position.
- Calls with no matching same-document function declaration return no hints.
- Diagnostics, formatting, completion, hover, definition, references, rename, semantic tokens,
  signature help, document highlights, folding ranges, selection ranges, workspace symbols, document
  links, code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file function lookup.
- Do not infer or display expression types.
- Do not validate arity or overloads.

---

# Phase 108: LSP Range Formatting

Status: Complete.

## Goal

Expose formatter edits for selected TypeC source ranges.

## Semantics

- `textDocument/rangeFormatting` formats only the requested range of the opened document.
- The selected text is formatted with the existing TypeC token formatter.
- Empty or inverted ranges return no edits.
- The returned edit replaces exactly the requested range.
- Full-document formatting remains unchanged.
- Diagnostics, completion, hover, definition, references, rename, semantic tokens, signature help,
  document highlights, folding ranges, selection ranges, workspace symbols, document links, inlay
  hints, code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add parser-aware range expansion.
- Do not write files from the LSP server.
- Do not format unopened documents.

---

# Phase 109: LSP Code Lens

Status: Complete.

## Goal

Expose same-document function reference counts as editor code lenses.

## Semantics

- `textDocument/codeLens` returns one code lens for each function declaration in the opened
  document.
- Code lenses are derived from lexer tokens only.
- Each code lens range covers the function declaration name.
- Each code lens command title is `<count> references`, where `count` excludes the declaration
  token.
- Missing or unopened documents return no code lenses.
- Diagnostics, formatting, range formatting, completion, hover, definition, references, rename,
  semantic tokens, signature help, document highlights, folding ranges, selection ranges, workspace
  symbols, document links, inlay hints, code actions, document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file reference counting.
- Do not add executable editor commands.
- Do not add parser/type-checker dependency to code lens generation.

---

# Phase 110: LSP Type Definition

Status: Complete.

## Goal

Expose same-document type-definition navigation for TypeC type names.

## Semantics

- `textDocument/typeDefinition` returns the declaration location for a same-document type name.
- Type declarations include `type`, `struct`, `class`, `interface`, `enum`, and `union` names.
- Lookup is lexer-token based and case-sensitive.
- Unknown identifiers, value-only declarations, whitespace, and unopened documents return `null`.
- Diagnostics, formatting, range formatting, completion, hover, definition, references, rename,
  semantic tokens, signature help, document highlights, folding ranges, selection ranges, workspace
  symbols, document links, inlay hints, code actions, code lenses, document symbols, and emitted C
  are unchanged.

## Do Not

- Do not add cross-file type lookup.
- Do not infer expression result types.
- Do not use parser/type-checker state for this phase.

---

# Phase 111: LSP Declaration

Status: Complete.

## Goal

Expose same-document declaration navigation for TypeC identifiers.

## Semantics

- `textDocument/declaration` returns the declaration location for an identifier in the opened
  document.
- Declaration lookup uses the existing same-document symbol model.
- Top-level declarations, function parameters, and local `let`/`const` bindings are supported.
- Unknown identifiers, whitespace, and unopened documents return `null`.
- Diagnostics, formatting, range formatting, completion, hover, definition, type definition,
  references, rename, semantic tokens, signature help, document highlights, folding ranges,
  selection ranges, workspace symbols, document links, inlay hints, code actions, code lenses,
  document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file declaration lookup.
- Do not add scope-sensitive shadow resolution beyond the existing symbol model.
- Do not use parser/type-checker state for this phase.

---

# Phase 112: LSP Linked Editing Ranges

Status: Complete.

## Goal

Expose same-document linked editing ranges for TypeC identifiers.

## Semantics

- `textDocument/linkedEditingRange` returns ranges for all same-document occurrences of the
  identifier under the cursor when that identifier has a known declaration.
- Linked editing uses the existing same-document symbol model.
- Top-level declarations, function parameters, and local `let`/`const` bindings are supported.
- Unknown identifiers, whitespace, and unopened documents return `null`.
- Diagnostics, formatting, range formatting, completion, hover, declaration, definition, type
  definition, references, rename, semantic tokens, signature help, document highlights, folding
  ranges, selection ranges, workspace symbols, document links, inlay hints, code actions, code
  lenses, document symbols, and emitted C are unchanged.

## Do Not

- Do not add cross-file linked editing.
- Do not add parser/type-checker dependency.
- Do not alter rename behavior.

---

# Phase 113: LSP Call Hierarchy Prepare

Status: Complete.

## Goal

Expose same-document function symbols as call hierarchy roots.

## Semantics

- `textDocument/prepareCallHierarchy` returns one call hierarchy item when the cursor is on a
  function declaration name or on an identifier that resolves to a same-document function
  declaration.
- The call hierarchy item range covers the function declaration name.
- The selection range is the same as the item range.
- Unknown identifiers, non-function symbols, whitespace, and unopened documents return `null`.
- Diagnostics, formatting, range formatting, completion, hover, declaration, definition, type
  definition, references, rename, semantic tokens, signature help, document highlights, folding
  ranges, selection ranges, workspace symbols, document links, inlay hints, linked editing, code
  actions, code lenses, document symbols, and emitted C are unchanged.

## Do Not

- Do not add incoming or outgoing call queries in this phase.
- Do not add cross-file call hierarchy roots.
- Do not use parser/type-checker state.

---

# Phase 114: LSP Incoming Call Hierarchy

Status: Complete.

## Goal

Expose same-document incoming calls for prepared call hierarchy function items.

## Semantics

- `callHierarchy/incomingCalls` accepts a prepared same-document function item.
- It returns one incoming call entry per same-document caller function that directly calls the
  target function.
- Each entry `from` item describes the caller function declaration name.
- Each entry `fromRanges` contains the direct call identifier ranges inside that caller function.
- Unknown targets, non-function items, unopened documents, and functions with no direct callers
  return an empty array.
- Diagnostics, formatting, range formatting, completion, hover, declaration, definition, type
  definition, references, rename, semantic tokens, signature help, document highlights, folding
  ranges, selection ranges, workspace symbols, document links, inlay hints, linked editing, code
  actions, code lenses, document symbols, call hierarchy preparation, and emitted C are unchanged.

## Do Not

- Do not add outgoing call queries in this phase.
- Do not add cross-file call queries.
- Do not use parser/type-checker state.

---

# Phase 115: VSCode Extension Wrapper

Status: Complete.

## Goal

Provide a minimal VSCode extension wrapper that starts the TypeC LSP over stdio.

## Semantics

- The extension registers `.tc` files as TypeC documents with language id `typec`.
- The extension starts the language server with the bundled repository compiler command by default.
- Users may override the compiler path with a VSCode setting.
- The language client connects only to file-backed TypeC documents.
- The extension wrapper does not change compiler, LSP, diagnostics, formatting, emitted C, or CLI
  behavior.

## Do Not

- Do not add VSCode-only language semantics.
- Do not duplicate LSP features in the extension client.
- Do not require a JavaScript runtime in TypeC programs.

---

# Future Language Feature: Borrowed Interface Values and VTable Dispatch

Status: Complete for explicit borrowed `Interface&` views.

## Goal

Add runtime polymorphism for interfaces without JavaScript prototypes, hidden allocation, or object
ownership. Interface values are borrowed views over existing concrete values and dispatch through
static vtables emitted to C.

## Syntax

Interface declarations continue to use TypeScript-like syntax:

```ts
interface Drawable {
  draw(): void;
}

class Circle implements Drawable {
  radius: i32;

  draw(): void {
    // ...
  }
}

function render(d: Drawable): void {
  d.draw();
}
```

A concrete value whose type implements an interface may be converted to that interface value only
when the concrete value has storage that remains valid for the interface value's lifetime.

## Semantics

- Interface values are always borrowed.
- Interface values never own, allocate, clone, move, or free the underlying concrete value.
- An interface value is a fat value containing:
  - a pointer to the concrete value
  - a pointer to the interface vtable for that concrete type
- Interface dispatch calls the function pointer in the vtable with the concrete pointer as the
  receiver.
- Interface values may be passed by value; copying an interface value copies only the borrowed view,
  not the underlying concrete value.
- Returning an interface value that points to a local stack value is rejected.
- Storing an interface value beyond the lifetime of the borrowed concrete value is rejected when the
  compiler can prove the lifetime is invalid.
- Interface conversion does not change concrete object layout.
- Concrete records/classes do not receive hidden vptr fields.
- Dispatch is nominal through `implements` in this phase; structural interface conversion may be
  considered later only after explicit coherence rules are defined.
- `this` is available only inside instance methods and constructors.
- `this` refers to the current concrete receiver, not an interface vtable or interface wrapper.
- Interface values are called with normal method syntax such as `drawable.draw()`.
- Interface vtables are a compiler lowering detail and are not accessible from TypeC source.
- Source expressions such as `drawable.vtable.draw()` are rejected unless `vtable` is an ordinary
  user-declared field on a non-interface type.

## C Lowering

For an interface:

```ts
interface Drawable {
  draw(): void;
}
```

Emit a vtable shape and a borrowed interface value shape similar to:

```c
typedef struct {
  void (*draw)(void* self);
} TypeC_Drawable_VTable;

typedef struct {
  void* self;
  const TypeC_Drawable_VTable* vtable;
} TypeC_Drawable;
```

For a class implementing the interface:

```c
static void TypeC_Circle_Drawable_draw(void* self) {
  TypeC_Circle* concrete = (TypeC_Circle*)self;
  TypeC_Circle_draw(concrete);
}

static const TypeC_Drawable_VTable TypeC_Circle_as_Drawable = {
  .draw = TypeC_Circle_Drawable_draw,
};
```

A conversion from `Circle` storage to `Drawable` lowers to:

```c
TypeC_Drawable d = {
  .self = &circle,
  .vtable = &TypeC_Circle_as_Drawable,
};
```

A call:

```ts
d.draw();
```

lowers to:

```c
d.vtable->draw(d.self);
```

## Receiver Rules

- Initial interface methods dispatch through a borrowed concrete receiver.
- Method compatibility must respect the concrete method's existing receiver behavior.
- Mutable receiver support must be specified explicitly before methods that require mutable access
  can be called through immutable borrowed interface values.
- No method call through an interface may implicitly allocate, box, clone, or extend the lifetime of
  the receiver.

## Valid Example

```ts
function renderCircle(circle: Circle): void {
  const drawable: Drawable = circle;
  render(drawable);
}
```

## Rejected Example

```ts
function makeDrawable(): Drawable {
  const circle = new Circle(10);
  return circle;
}
```

This is rejected because `circle` is local storage and the returned `Drawable` would borrow a value
that no longer exists after the function returns.

## Do

- Keep interface values non-owning.
- Keep concrete class/record layouts unchanged.
- Emit explicit C structs and vtables.
- Require clear lifetime diagnostics for invalid borrowed interface values.
- Start with nominal `implements`-based dispatch.

## Do Not

- Do not add C++-style hidden vptr fields to every object.
- Do not add JavaScript prototype semantics.
- Do not allocate or box automatically during interface conversion.
- Do not let interface values own or free concrete values.
- Do not add multiple inheritance or C++ ABI complexity.
- Do not add structural interface conversion until coherence and ambiguity rules are specified.
- Do not expose interface `self` or `vtable` fields to TypeC source code.

---

# Future Language Feature: Roadmap Documentation Cleanup

Status: Complete in Phase 217.

## Goal

Keep user-facing roadmap documentation consistent with this phase document.

## Semantics

- `README.md` must report the latest completed phase accurately.
- `README.md` may also mention the latest planned phase separately.
- The support matrix should not describe completed features as missing.
- Phase numbers in docs should match `TYPEC_PHASES.md`.

## Do

- Update roadmap and support status whenever a phase is completed.
- Keep planned features separate from completed features.
- Prefer honest "partial" status over overstating TypeScript compatibility.

## Do Not

- Do not let README phase numbers drift behind this document.
- Do not mark planned features as implemented.

---

# Future Language Feature: Optional Constructor Inference

Status: Complete.

## Goal

Reduce optional annotation noise by allowing optional constructors to infer `T` from context.

## Syntax

```ts
const a: Option<i32> = Some(1);
const b: Option<i32> = None();
```

Existing explicit forms remain valid:

```ts
const a: Option<i32> = Some<i32>(1);
const b: Option<i32> = None<i32>();
```

## Semantics

- `Some(value)` may infer `T` from the expected optional type.
- `None()` may infer `T` only from an expected optional type.
- Ambiguous optional construction without context is rejected.
- No implicit `null` or `undefined` is introduced.

---

# Future Language Feature: Improved Generic Inference

Status: Planned.

## Goal

Reduce explicit type arguments for generic functions and classes while keeping monomorphization
predictable.

## Semantics

- Infer generic arguments from function arguments where constraints are unambiguous.
- Use expected return/contextual types only when doing so does not create circular inference.
- Preserve explicit type arguments as the disambiguation mechanism.
- Reject ambiguous inference with clear diagnostics.

---

# Future Language Feature: Scalar Type Aliases

Status: Complete.

## Goal

Allow type aliases for scalar and other non-record types when lowering remains purely static.

## Syntax

```ts
type UserId = u64;
type Distance = f64;
```

## Semantics

- Scalar aliases are compile-time aliases, not distinct runtime wrapper types.
- C emission uses the underlying scalar representation.
- Alias expansion must preserve diagnostics that mention the source alias where helpful.

---

# Future Language Feature: Re-exports

Status: Complete for static named, aliased, default, and type-only forms.

## Goal

Support static module forwarding without adding JavaScript module-loader semantics.

## Syntax

```ts
export { Point } from "./point.tc";
export { Vec2 as Vector2 } from "./vec2.tc";
```

## Semantics

- Re-exports are compile-time module graph edges.
- Re-exported names must resolve to known exported declarations.
- Default exports are static declaration selections, not JavaScript module objects.
- No dynamic imports or live JavaScript binding semantics are introduced.

---

# Future Language Feature: Default and Rest Parameters

Status: Complete for ordinary static TypeC functions.

## Goal

Add common TypeScript call ergonomics for ordinary TypeC functions without hidden allocation.

## Syntax

```ts
function clamp(value: i32, min: i32 = 0, max: i32 = 100): i32 {
  // ...
}

function sum(...values: i32[]): i32 {
  return values.length();
}
```

## Semantics

- Default parameters are evaluated at the call site or lowered equivalently with no hidden closure.
- Rest parameters must lower to a static slice/array representation, not a JavaScript array.
- C variadic externs remain separate from TypeC rest parameters.

---

# Future Language Feature: Optional Record Fields

Status: Complete.

## Goal

Support TS-like optional fields with explicit optional-type semantics.

## Syntax

```ts
type Config = {
  path: Str;
  retries?: i32;
};
```

## Semantics

- `field?: T` means `field: Option<T>` at the TypeC semantic level.
- Missing optional fields in literals are initialized as `None<T>()`.
- Present optional fields are initialized as `Some<T>(value)` unless already optional.
- No implicit `undefined` is introduced.

---

# Future Language Feature: Standard Array Helpers

Status: Partial.

## Goal

Add small `std` helpers for common static array and slice operations without JavaScript array
semantics.

## Semantics

- Helpers operate on TypeC arrays/slices with explicit lengths.
- No sparse arrays, dynamic property lookup, hidden allocation, or JS prototype methods.
- Initial helpers should favor simple operations such as length access, fill, copy, find, and map
  where C lowering is clear.

---

# Phase 116: LSP Outgoing Call Hierarchy

Status: Complete.

## Goal

Expose same-document outgoing calls for prepared call hierarchy function items.

## Semantics

- `callHierarchy/outgoingCalls` accepts a prepared same-document function item.
- It returns one outgoing call entry per same-document target function directly called by the source
  function.
- Each entry `to` item describes the target function declaration name.
- Each entry `fromRanges` contains the direct call identifier ranges inside the source function.
- Unknown sources, non-function items, unopened documents, and functions with no direct outgoing
  calls return an empty array.
- Diagnostics, formatting, range formatting, completion, hover, declaration, definition, type
  definition, references, rename, semantic tokens, signature help, document highlights, folding
  ranges, selection ranges, workspace symbols, document links, inlay hints, linked editing, code
  actions, code lenses, document symbols, call hierarchy preparation, incoming call hierarchy, and
  emitted C are unchanged.

## Do Not

- Do not add cross-file call queries.
- Do not use parser/type-checker state.
- Do not infer calls through function pointers or methods.

---

# Phase 117: VSCode Check Current File Command

Status: Complete.

## Goal

Add a VSCode command that checks the currently opened TypeC file with the TypeC compiler.

## Semantics

- The extension contributes `typec.checkCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Check Current File`.
- The command runs the configured TypeC compiler with `check <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Compiler, LSP, diagnostics, formatting, emitted C, CLI behavior, and TypeC language semantics are
  unchanged.

## Do Not

- Do not duplicate compiler diagnostics in the extension.
- Do not add build, run, clean, or format commands in this phase.
- Do not use shell-specific command construction.

---

# Phase 118: VSCode Build Current File Command

Status: Complete.

## Goal

Add a VSCode command that builds the currently opened TypeC file with the TypeC compiler.

## Semantics

- The extension contributes `typec.buildCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Build Current File`.
- The command runs the configured TypeC compiler with `build <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by check and build commands.
- Compiler, LSP, diagnostics, formatting, emitted C, CLI behavior, and TypeC language semantics are
  unchanged.

## Do Not

- Do not duplicate compiler diagnostics in the extension.
- Do not add run, clean, or format commands in this phase.
- Do not use shell-specific command construction.

---

# Phase 119: VSCode Run Current File Command

Status: Complete.

## Goal

Add a VSCode command that runs the currently opened TypeC file with the TypeC compiler.

## Semantics

- The extension contributes `typec.runCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Run Current File`.
- The command runs the configured TypeC compiler with `run <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by check, build, and run commands.
- Compiler, LSP, diagnostics, formatting, emitted C, CLI behavior, and TypeC language semantics are
  unchanged.

## Do Not

- Do not duplicate compiler diagnostics in the extension.
- Do not add clean or format commands in this phase.
- Do not use shell-specific command construction.

---

# Phase 120: VSCode Clean Current File Command

Status: Complete.

## Goal

Add a VSCode command that removes generated artifacts for the currently opened TypeC file with the
TypeC compiler.

## Semantics

- The extension contributes `typec.cleanCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Clean Current File`.
- The command runs the configured TypeC compiler with `clean <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by check, build, run, and clean commands.
- Compiler, LSP, diagnostics, formatting, emitted C, CLI behavior, and TypeC language semantics are
  unchanged.

## Do Not

- Do not duplicate compiler diagnostics in the extension.
- Do not add format commands in this phase.
- Do not delete files directly from the extension.
- Do not use shell-specific command construction.

---

# Phase 121: VSCode Format Current File Command

Status: Complete.

## Goal

Add a VSCode command that formats the currently opened TypeC file with the TypeC compiler.

## Semantics

- The extension contributes `typec.formatCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Format Current File`.
- The command runs the configured TypeC compiler with `fmt <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by check, build, run, clean, and format commands.
- Formatting behavior remains owned by the compiler CLI and LSP formatter.
- Compiler, LSP, diagnostics, emitted C, CLI behavior, and TypeC language semantics are unchanged.

## Do Not

- Do not implement formatting logic in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not add project-wide format commands in this phase.
- Do not use shell-specific command construction.

---

# Phase 122: VSCode Format Check Current File Command

Status: Complete.

## Goal

Add a VSCode command that checks whether the currently opened TypeC file is formatted according to
the TypeC compiler formatter.

## Semantics

- The extension contributes `typec.formatCheckCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Check Current File Formatting`.
- The command runs the configured TypeC compiler with `fmt-check <file>` through VSCode task
  execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by check, build, run, clean, format, and format-check
  commands.
- Formatting validation behavior remains owned by the compiler CLI.
- Compiler, LSP, diagnostics, emitted C, CLI behavior, and TypeC language semantics are unchanged.

## Do Not

- Do not implement formatting checks in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not add project-wide format-check commands in this phase.
- Do not use shell-specific command construction.

---

# Phase 123: VSCode Restart Language Server Command

Status: Complete.

## Goal

Add a VSCode command that restarts the TypeC language server without reloading the extension host.

## Semantics

- The extension contributes `typec.restartLanguageServer`.
- The command is available from VSCode's command palette as `TypeC: Restart Language Server`.
- The command stops the current `STC lsp` language client when one is active.
- The command starts a new TypeC language client using the existing compiler path resolution rules.
- The command reuses existing client construction logic.
- The command reports completion through VSCode information messages.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not add new LSP protocol methods in this phase.
- Do not duplicate compiler diagnostics in the extension.
- Do not change compiler path configuration semantics.
- Do not reload the VSCode window or extension host.

---

# Phase 124: VSCode Show Language Server Output Command

Status: Complete.

## Goal

Add a VSCode command that opens the TypeC language server output channel.

## Semantics

- The extension contributes `typec.showLanguageServerOutput`.
- The command is available from VSCode's command palette as `TypeC: Show Language Server Output`.
- The command shows the existing TypeC language server output channel.
- The command reuses the same output channel used by the language client trace output.
- The command does not start, stop, or restart the language server.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not add new LSP protocol methods in this phase.
- Do not duplicate compiler diagnostics in the extension.
- Do not create per-command output channels.
- Do not change compiler path configuration semantics.

---

# Phase 125: VSCode Show Compiler Version Command

Status: Complete.

## Goal

Add a VSCode command that prints the configured TypeC compiler version through VSCode task
execution.

## Semantics

- The extension contributes `typec.showCompilerVersion`.
- The command is available from VSCode's command palette as `TypeC: Show Compiler Version`.
- The command runs the configured TypeC compiler with `version` through VSCode task execution.
- The command does not require an active editor.
- The command uses existing compiler path resolution rules.
- The command does not parse, check, build, format, or run TypeC source files.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not implement compiler version logic in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 126: VSCode Show Compiler Help Command

Status: Complete.

## Goal

Add a VSCode command that prints the configured TypeC compiler help text through VSCode task
execution.

## Semantics

- The extension contributes `typec.showCompilerHelp`.
- The command is available from VSCode's command palette as `TypeC: Show Compiler Help`.
- The command runs the configured TypeC compiler with `help` through VSCode task execution.
- The command does not require an active editor.
- The command uses existing compiler path resolution rules.
- The command does not parse, check, build, format, or run TypeC source files.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not implement compiler help text in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 127: VSCode Configure Compiler Path Command

Status: Complete.

## Goal

Add a VSCode command that opens the TypeC compiler path setting.

## Semantics

- The extension contributes `typec.configureCompilerPath`.
- The command is available from VSCode's command palette as `TypeC: Configure Compiler Path`.
- The command opens VSCode settings focused on `typec.compilerPath`.
- The command does not read, validate, or mutate the configured compiler path directly.
- The command does not require an active editor.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not implement custom settings UI in the extension.
- Do not validate filesystem paths in the extension.
- Do not change compiler path configuration semantics.
- Do not start, stop, or restart the language server in this phase.

---

# Phase 128: VSCode Configure Language Server Trace Command

Status: Complete.

## Goal

Add a VSCode command that opens the TypeC language server trace setting.

## Semantics

- The extension contributes `typec.configureLanguageServerTrace`.
- The command is available from VSCode's command palette as
  `TypeC: Configure Language Server Trace`.
- The command opens VSCode settings focused on `typec.trace.server`.
- The command does not read, validate, or mutate trace settings directly.
- The command does not require an active editor.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not implement custom settings UI in the extension.
- Do not change language client trace behavior in this phase.
- Do not change compiler path configuration semantics.
- Do not start, stop, or restart the language server in this phase.

---

# Phase 129: VSCode Parse Current File Command

Status: Complete.

## Goal

Add a VSCode command that parses the currently opened TypeC file through the configured compiler.

## Semantics

- The extension contributes `typec.parseCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Parse Current File`.
- The command runs the configured TypeC compiler with `parse <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by current-file compiler commands.
- Compiler, LSP protocol handlers, diagnostics, emitted C, CLI behavior, and TypeC language
  semantics are unchanged.

## Do Not

- Do not implement parsing in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 130: VSCode Emit C Current File Command

Status: Complete.

## Goal

Add a VSCode command that emits C for the currently opened TypeC file through the configured
compiler.

## Semantics

- The extension contributes `typec.emitCCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Emit C for Current File`.
- The command runs the configured TypeC compiler with `emit-c <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by current-file compiler commands.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not implement C emission in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 131: VSCode Emit AST Current File Command

Status: Complete.

## Goal

Add a VSCode command that emits the compiler AST for the currently opened TypeC file through the
configured compiler.

## Semantics

- The extension contributes `typec.emitAstCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Emit AST for Current File`.
- The command runs the configured TypeC compiler with `emit-ast <file>` through VSCode task
  execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by current-file compiler commands.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not implement AST emission in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 132: VSCode Watch Current File Command

Status: Complete.

## Goal

Add a VSCode command that runs the compiler watch mode for the currently opened TypeC file through
the configured compiler.

## Semantics

- The extension contributes `typec.watchCurrentFile`.
- The command is available from VSCode's command palette as `TypeC: Watch Current File`.
- The command runs the configured TypeC compiler with `watch <file>` through VSCode task execution.
- The command only accepts file-backed `.tc` documents using language id `typec`.
- Invalid active editors report a VSCode error message and do not launch a task.
- Shared VSCode task construction is reused by current-file compiler commands.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not implement file watching in the VSCode extension.
- Do not duplicate compiler diagnostics in the extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 133: VSCode Build Directory Setting

Status: Complete.

## Goal

Add a VSCode setting that lets artifact-producing current-file commands pass a configured build
output directory to the TypeC compiler.

## Semantics

- The extension contributes `typec.buildDir` as a string setting.
- Empty `typec.buildDir` preserves existing compiler task arguments.
- Non-empty `typec.buildDir` appends `--build-dir <dir>` only for current-file commands whose
  compiler subcommands support build artifacts: `build`, `run`, `clean`, and `watch`.
- Current-file commands for `check`, `fmt`, `fmt-check`, `parse`, `emit-c`, and `emit-ast` do not
  receive `--build-dir`.
- The setting value is passed as a process argument without shell interpolation.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not create directories in the VSCode extension.
- Do not validate or canonicalize the build directory in the VSCode extension.
- Do not use shell-specific command construction.
- Do not change compiler path configuration semantics.

---

# Phase 134: VSCode Configure Build Directory Command

Status: Complete.

## Goal

Add a VSCode command that opens the setting used by current-file artifact commands to pass a build
output directory to the compiler.

## Semantics

- The extension contributes `typec.configureBuildDir`.
- The command is available from VSCode's command palette as `TypeC: Configure Build Directory`.
- The command opens VSCode settings focused on `typec.buildDir`.
- The extension does not validate, canonicalize, create, or mutate the build directory value.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not create directories in the VSCode extension.
- Do not validate or canonicalize the build directory in the VSCode extension.
- Do not change current-file command argument semantics.
- Do not change compiler path configuration semantics.

---

# Phase 135: VSCode Configure Extension Settings Command

Status: Complete.

## Goal

Add a VSCode command that opens the TypeC extension settings page without changing any compiler or
language semantics.

## Semantics

- The extension contributes `typec.configureSettings`.
- The command is available from VSCode's command palette as `TypeC: Configure Settings`.
- The command opens VSCode settings focused on this TypeC extension's contributed settings.
- The extension does not validate, canonicalize, create, or mutate setting values.
- Existing focused settings commands remain unchanged.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not duplicate settings UI in the extension.
- Do not validate or mutate settings from this command.
- Do not change current-file command argument semantics.
- Do not change compiler path or build directory configuration semantics.

---

# Phase 136: VSCode Editor Context Menu Current File Commands

Status: Complete.

## Goal

Expose existing current-file TypeC commands from the VSCode editor context menu for `.tc` files.

## Semantics

- The extension contributes editor context menu entries for existing current-file commands.
- Menu entries are shown only when the active editor language id is `typec`.
- Menu entries invoke the same command ids already used by the Command Palette.
- The extension does not add new compiler actions or duplicate compiler semantics.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not add new VSCode command implementations.
- Do not parse or validate TypeC source in the extension.
- Do not change current-file command argument semantics.
- Do not change compiler path or build directory configuration semantics.

---

# Phase 137: VSCode Explorer Context Menu Current File Commands

Status: Complete.

## Goal

Expose existing current-file TypeC commands from the VSCode Explorer context menu for `.tc` files.

## Semantics

- The extension contributes Explorer context menu entries for existing current-file commands.
- Menu entries are shown only for `.tc` file resources.
- Menu entries invoke the same command ids already used by the Command Palette and editor context
  menu.
- Current-file command handlers accept an optional file URI from VSCode menu invocation.
- When a command is invoked without a file URI, active TypeC editor behavior is unchanged.
- File URI invocation accepts only file-backed `.tc` resources.
- The extension does not add new compiler actions or duplicate compiler semantics.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not add new compiler command implementations.
- Do not parse or validate TypeC source in the extension.
- Do not change current-file compiler argument semantics except selecting the source file from a
  VSCode-provided URI.
- Do not change compiler path or build directory configuration semantics.

---

# Phase 138: VSCode Build Task Grouping

Status: Complete.

## Goal

Mark the existing VSCode build-current-file task as a VSCode build task without changing compiler
behavior.

## Semantics

- The `TypeC: Build Current File` command still invokes `build <file>` through the configured
  compiler.
- The VSCode task created for the `build` current-file action is assigned to
  `vscode.TaskGroup.Build`.
- Non-build current-file tasks are not assigned to a VSCode task group.
- Non-source compiler tasks such as `version` and `help` are unchanged.
- Compiler, LSP protocol handlers, diagnostics, emitted C semantics, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not add problem matchers in this phase.
- Do not change compiler arguments.
- Do not change current-file source selection semantics.
- Do not change compiler path or build directory configuration semantics.

---

# Phase 139: VSCode Current File Problem Matcher

Status: Complete.

## Goal

Expose TypeC compiler diagnostics from existing VSCode current-file tasks through a VSCode problem
matcher.

## Semantics

- Add one VSCode problem matcher for compiler diagnostics shaped as
  `<file>:<line>:<column>: <message>`.
- Existing current-file tasks use the TypeC problem matcher.
- The problem matcher only interprets compiler output; it does not validate TypeC source or
  duplicate compiler diagnostics.
- Non-source compiler tasks such as `version` and `help` are unchanged.
- Compiler, LSP protocol handlers, emitted C semantics, CLI arguments, source selection behavior,
  and TypeC language semantics are unchanged.

## Do Not

- Do not change compiler diagnostic text in this phase.
- Do not add VSCode-side semantic validation.
- Do not change task command arguments.
- Do not change build task grouping.

---

# Phase 140: VSCode Build Task Provider

Status: Complete.

## Goal

Expose the existing build-current-file task through VSCode's task provider so users can run it from
VSCode task commands.

## Semantics

- Register a TypeC task provider for the existing `typec` task type.
- When the active editor contains a file-backed TypeC `.tc` document, the provider exposes one build
  task for that active file.
- The provided task reuses existing task construction, build directory handling, task grouping, and
  problem matcher behavior.
- If no active file-backed TypeC document exists, the provider exposes no tasks.
- Command Palette current-file commands, Explorer context menu commands, compiler behavior, LSP
  protocol handlers, emitted C semantics, CLI arguments, and TypeC language semantics are unchanged.

## Do Not

- Do not add new compiler commands in this phase.
- Do not duplicate compiler diagnostics or semantic checks in the VSCode extension.
- Do not provide tasks for unopened workspace files.
- Do not change current-file command behavior.

---

# Phase 141: Roadmap Numbering Repair and Language Track Reset

Status: Complete.

## Goal

Repair roadmap numbering after the VSCode tooling sequence and make the next development direction
explicitly language/compiler focused.

## Semantics

- `TYPEC_PHASES.md` must not contain duplicate numbered phases for the completed 115-140 range.
- Previously drafted but unimplemented language ideas are retained as future language features, not
  numbered completed phases.
- `README.md` reports the actual latest completed phase.
- `README.md` names the next planned work as language/compiler tightening, not VSCode tooling.
- Compiler behavior, LSP handlers, VSCode command behavior, emitted C, CLI behavior, and TypeC
  language semantics are unchanged.

## Do Not

- Do not add new VSCode features in this phase.
- Do not change compiler semantics in this cleanup phase.
- Do not remove the borrowed-interface-value specification.
- Do not claim unimplemented language features are complete.

---

# Phase 142: Interface Value Type Diagnostics

Status: Complete.

## Goal

Tighten interface type-reference diagnostics before runtime interface values are implemented.

## Semantics

- Interface declarations remain valid static declarations for `implements` checks and generic
  constraints.
- Using an interface name as an ordinary value type is rejected with a specific diagnostic instead
  of being reported as an unknown type.
- The diagnostic makes clear that runtime interface value types are not implemented yet.
- Unknown non-interface names still report `Unknown type '<name>'`.
- No interface fat pointer, vtable dispatch, object layout, C emission, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface values in this phase.
- Do not add vtable lowering in this phase.
- Do not change class layout or method dispatch.
- Do not allow interface names as runtime value types yet.

---

# Phase 143: Generic Constraint Type Argument Diagnostics

Status: Complete.

## Goal

Tighten diagnostics for generic type arguments used with interface constraints.

## Semantics

- A constrained generic instantiation using an unknown named type argument reports
  `Unknown type '<name>'`.
- A constrained generic instantiation using an interface name as the type argument reports that
  interface value types are not implemented.
- Known concrete type arguments that fail an interface constraint keep reporting constraint failure.
- Function generic constraints and generic class constraints both use these diagnostics.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not allow interface names as concrete type arguments.
- Do not change generic monomorphization output for valid programs.
- Do not change class layout or method dispatch.

---

# Phase 144: Generic Constraint Declaration Diagnostics

Status: Complete.

## Goal

Validate generic parameter constraints at declaration time instead of waiting for instantiation.

## Semantics

- A generic parameter constraint must name a declared interface.
- A constraint naming an unknown type reports `Unknown type '<name>'`.
- A constraint naming a known non-interface type reports that the constraint must be an interface.
- Function generic parameter constraints and class generic parameter constraints are both checked.
- Duplicate generic parameter diagnostics remain unchanged.
- Valid generic constraints and generated C for valid programs are unchanged.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not allow non-interface generic constraints.
- Do not change generic monomorphization output for valid programs.
- Do not change class layout or method dispatch.

---

# Phase 145: Generic Class Constraint Concrete Type Diagnostics

Status: Complete.

## Goal

Report concrete class names used as generic class constraints as known non-interface types.

## Semantics

- Generic class parameter constraints must name declared interfaces.
- A generic class constraint naming a concrete class reports
  `Generic constraint '<name>' must be an interface`.
- Unknown generic class constraint names still report `Unknown type '<name>'`.
- Function generic constraint diagnostics remain unchanged.
- Duplicate generic parameter diagnostics remain unchanged.
- Valid generic class constraints and generated C for valid programs are unchanged.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not allow class names as generic constraints.
- Do not change generic class monomorphization output for valid programs.

---

# Phase 146: Explicit Generic Function Type Argument Fatal Diagnostics

Status: Complete.

## Goal

Stop invalid explicit generic function type arguments before generic instantiation and later checker
passes can emit duplicate or cascading diagnostics.

## Semantics

- Explicit generic function type arguments are validated before instantiation.
- An unknown named explicit type argument reports `Unknown type '<name>'` at the type argument span.
- An interface named as an explicit concrete type argument reports
  `Interface value type '<name>' is not implemented` at the type argument span.
- Valid explicit generic function type arguments and generated C for valid programs are unchanged.
- Generic class type argument diagnostics are unchanged in this phase.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change generic function monomorphization output for valid programs.

---

# Phase 147: Explicit Generic Class Type Argument Fatal Diagnostics

Status: Complete.

## Goal

Stop invalid explicit generic class type arguments before generic class instantiation and later
checker passes can emit cascading diagnostics.

## Semantics

- Explicit generic class type arguments are validated before instantiation.
- An unknown named explicit type argument reports `Unknown type '<name>'` at the type argument span.
- An interface named as an explicit concrete type argument reports
  `Interface value type '<name>' is not implemented` at the type argument span.
- Valid explicit generic class type arguments and generated C for valid programs are unchanged.
- Generic function type argument diagnostics are unchanged in this phase.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change generic class monomorphization output for valid programs.

---

# Phase 148: Generic Constraint Enum and Union Declaration Diagnostics

Status: Complete.

## Goal

Report enum and tagged union names used as generic constraints as known non-interface types.

## Semantics

- Generic parameter constraints must name declared interfaces.
- A generic function or class constraint naming an enum reports
  `Generic constraint '<name>' must be an interface`.
- A generic function or class constraint naming a tagged union reports
  `Generic constraint '<name>' must be an interface`.
- Unknown generic constraint names still report `Unknown type '<name>'`.
- Valid generic constraints and generated C for valid programs are unchanged.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not allow enum or tagged union names as generic constraints.
- Do not implement runtime interface dispatch in this phase.
- Do not change generic monomorphization output for valid programs.

---

# Phase 149: Generic Class Constraint Struct Declaration Diagnostics

Status: Complete.

## Goal

Report struct names used as generic class constraints as known non-interface types.

## Semantics

- Generic class parameter constraints must name declared interfaces.
- A generic class constraint naming a struct reports
  `Generic constraint '<name>' must be an interface`.
- Unknown generic class constraint names still report `Unknown type '<name>'`.
- Generic function struct constraint diagnostics are unchanged.
- Valid generic class constraints and generated C for valid programs are unchanged.
- No runtime interface values, vtables, dispatch, object layout, emitted C behavior, CLI, LSP, or
  VSCode behavior changes are introduced in this phase.

## Do Not

- Do not allow struct names as generic class constraints.
- Do not implement runtime interface dispatch in this phase.
- Do not change generic class monomorphization output for valid programs.

---

# Phase 150: Explicit Generic Function Enum Type Arguments

Status: Complete.

## Goal

Allow enum names as explicit generic function type arguments instead of reporting them as unknown
types.

## Semantics

- A declared enum is a known concrete type argument for generic function instantiation.
- `fn<EnumName>(value)` is accepted when ordinary type checking accepts the argument and result
  types.
- Unknown explicit generic function type arguments still report `Unknown type '<name>'`.
- Interface explicit generic function type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic class type argument diagnostics are unchanged in this phase.
- Tagged union type argument handling is unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change tagged union generic type argument handling in this phase.

---

# Phase 151: Explicit Generic Class Enum Type Arguments

Status: Complete.

## Goal

Allow enum names as explicit generic class type arguments instead of reporting them as unknown
types.

## Semantics

- A declared enum is a known concrete type argument for generic class instantiation.
- `ClassName<EnumName>` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic class type arguments still report `Unknown type '<name>'`.
- Interface explicit generic class type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic function type argument diagnostics are unchanged in this phase.
- Tagged union type argument handling is unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change tagged union generic type argument handling in this phase.

---

# Phase 152: Explicit Generic Function Tagged Union Type Arguments

Status: Complete.

## Goal

Allow tagged union names as explicit generic function type arguments instead of reporting them as
unknown types.

## Semantics

- A declared tagged union is a known concrete type argument for generic function instantiation.
- `fn<TaggedUnionName>(value)` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic function type arguments still report `Unknown type '<name>'`.
- Interface explicit generic function type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic class type argument diagnostics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 153: Explicit Generic Class Tagged Union Type Arguments

Status: Complete.

## Goal

Allow tagged union names as explicit generic class type arguments instead of reporting them as
unknown types.

## Semantics

- A declared tagged union is a known concrete type argument for generic class instantiation.
- `ClassName<TaggedUnionName>` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic class type arguments still report `Unknown type '<name>'`.
- Interface explicit generic class type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic function type argument diagnostics are unchanged in this phase.
- Generic constraint semantics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 154: Explicit Generic Class Struct Type Arguments

Status: Complete.

## Goal

Allow struct names as explicit generic class type arguments instead of reporting them as unknown
types.

## Semantics

- A declared struct is a known concrete type argument for generic class instantiation.
- `ClassName<StructName>` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic class type arguments still report `Unknown type '<name>'`.
- Interface explicit generic class type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic function type argument diagnostics are unchanged in this phase.
- Generic constraint semantics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 155: Explicit Generic Function Struct Type Arguments

Status: Complete.

## Goal

Lock in explicit generic function type arguments that name structs.

## Semantics

- A declared struct is a known concrete type argument for generic function instantiation.
- Struct declarations are lowered to record type aliases before generic function diagnostics.
- `fn<StructName>(value)` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic function type arguments still report `Unknown type '<name>'`.
- Interface explicit generic function type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic class type argument diagnostics are unchanged in this phase.
- Generic constraint semantics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 156: Explicit Generic Function Class Type Arguments

Status: Complete.

## Goal

Lock in explicit generic function type arguments that name concrete classes.

## Semantics

- A declared concrete class is a known concrete type argument for generic function instantiation.
- Class declarations are lowered to concrete record type aliases before generic function
  diagnostics.
- `fn<ClassName>(value)` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic function type arguments still report `Unknown type '<name>'`.
- Interface explicit generic function type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic class type argument diagnostics are unchanged in this phase.
- Generic constraint semantics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 157: Explicit Generic Class Class Type Arguments

Status: Complete.

## Goal

Lock in explicit generic class type arguments that name concrete classes.

## Semantics

- A declared concrete class is a known concrete type argument for generic class instantiation.
- `ClassName<ConcreteClassName>` is accepted when ordinary type checking accepts the value shape.
- Unknown explicit generic class type arguments still report `Unknown type '<name>'`.
- Interface explicit generic class type arguments still report
  `Interface value type '<name>' is not implemented`.
- Generic function type argument diagnostics are unchanged in this phase.
- Generic constraint semantics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change generic constraint semantics in this phase.

---

# Phase 158: Generic Function Constraint Class and Struct Diagnostics

Status: Complete.

## Goal

Lock in generic function declaration diagnostics for class and struct names used as constraints.

## Semantics

- Generic function constraints must name interfaces.
- A constraint naming a concrete class reports `Generic constraint '<name>' must be an interface`.
- A constraint naming a struct reports `Generic constraint '<name>' must be an interface`.
- Unknown constraints still report `Unknown type '<name>'`.
- Interface constraints remain accepted.
- Generic class constraint diagnostics are unchanged in this phase.
- Generic type argument diagnostics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class constraint handling in this phase.
- Do not change explicit generic type argument handling in this phase.

---

# Phase 159: Generic Function Constraint Type Alias Diagnostics

Status: Complete.

## Goal

Lock in generic function declaration diagnostics for type alias names used as constraints.

## Semantics

- Generic function constraints must name interfaces.
- A constraint naming a type alias reports `Generic constraint '<name>' must be an interface`.
- Unknown constraints still report `Unknown type '<name>'`.
- Interface constraints remain accepted.
- Generic class constraint diagnostics are unchanged in this phase.
- Generic type argument diagnostics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class constraint handling in this phase.
- Do not change explicit generic type argument handling in this phase.

---

# Phase 160: Generic Class Constraint Type Alias Diagnostics

Status: Complete.

## Goal

Lock in generic class declaration diagnostics for type alias names used as constraints.

## Semantics

- Generic class constraints must name interfaces.
- A constraint naming a type alias reports `Generic constraint '<name>' must be an interface`.
- Unknown constraints still report `Unknown type '<name>'`.
- Interface constraints remain accepted.
- Generic function constraint diagnostics are unchanged in this phase.
- Generic type argument diagnostics are unchanged in this phase.
- Generated C for existing valid programs is unchanged.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function constraint handling in this phase.
- Do not change explicit generic type argument handling in this phase.

---

# Phase 161: Explicit Generic Function Type Alias Type Arguments

Status: Complete.

## Goal

Lock in explicit generic function type arguments for type alias names.

## Semantics

- Explicit generic function type arguments may name type aliases.
- A call like `id<Point>(p)` instantiates the generic function for `Point` when `Point` is a type
  alias and the value argument is assignable to that alias.
- Unknown explicit generic function type arguments still report `Unknown type '<name>'`.
- Interface explicit generic function type arguments remain rejected as ordinary value types.
- Generic class type argument behavior is unchanged in this phase.
- Generic constraint diagnostics are unchanged in this phase.
- Generated C uses the alias name in the monomorphized function symbol.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic class type argument handling in this phase.
- Do not change generic constraint handling in this phase.

---

# Phase 162: Explicit Generic Class Type Alias Type Arguments

Status: Complete.

## Goal

Lock in explicit generic class type arguments for type alias names.

## Semantics

- Explicit generic class type arguments may name type aliases.
- A type reference like `Holder<Point>` instantiates the generic class for `Point` when `Point` is a
  type alias and assigned values are compatible with that alias.
- Unknown explicit generic class type arguments still report `Unknown type '<name>'`.
- Interface explicit generic class type arguments remain rejected as ordinary value types.
- Generic function type argument behavior is unchanged in this phase.
- Generic constraint diagnostics are unchanged in this phase.
- Generated C uses the alias name in the monomorphized class symbol.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change generic function type argument handling in this phase.
- Do not change generic constraint handling in this phase.

---

# Phase 163: Inferred Generic Function Type Alias Type Arguments

Status: Complete.

## Goal

Lock in inferred generic function type arguments for type alias values.

## Semantics

- Generic function calls may infer a type parameter from an argument whose type is a type alias.
- A call like `id(p)` instantiates the generic function for `Point` when `p` has type `Point`.
- The inferred alias name is preserved for monomorphized function naming.
- Explicit generic function type argument behavior is unchanged in this phase.
- Generic class type argument behavior is unchanged in this phase.
- Generic constraint diagnostics are unchanged in this phase.
- Generated C uses the alias name in the monomorphized function symbol.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change explicit generic type argument diagnostics in this phase.
- Do not change generic class instantiation handling in this phase.
- Do not change generic constraint handling in this phase.

---

# Phase 164: Inferred Generic Function Enum Type Arguments

Status: Complete.

## Goal

Lock in inferred generic function type arguments for enum values.

## Semantics

- Generic function calls may infer a type parameter from an argument whose type is an enum.
- A call like `id(key)` instantiates the generic function for `Key` when `key` has type `Key`.
- The inferred enum name is preserved for monomorphized function naming.
- Explicit generic function type argument behavior is unchanged in this phase.
- Generic class type argument behavior is unchanged in this phase.
- Generic constraint diagnostics are unchanged in this phase.
- Generated C uses the enum name in the monomorphized function symbol.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change explicit generic type argument diagnostics in this phase.
- Do not change generic class instantiation handling in this phase.
- Do not change generic constraint handling in this phase.

---

# Phase 165: Inferred Generic Function Tagged Union Type Arguments

Status: Complete.

## Goal

Lock in inferred generic function type arguments for tagged union values.

## Semantics

- Generic function calls may infer a type parameter from an argument whose type is a tagged union.
- A call like `id(value)` instantiates the generic function for `Value` when `value` has type
  `Value`.
- The inferred tagged union name is preserved for monomorphized function naming.
- Explicit generic function type argument behavior is unchanged in this phase.
- Generic class type argument behavior is unchanged in this phase.
- Generic constraint diagnostics are unchanged in this phase.
- Generated C uses the tagged union name in the monomorphized function symbol.
- No runtime interface values, vtables, dispatch, object layout, CLI, LSP, or VSCode behavior
  changes are introduced in this phase.

## Do Not

- Do not implement runtime interface dispatch in this phase.
- Do not change explicit generic type argument diagnostics in this phase.
- Do not change generic class instantiation handling in this phase.
- Do not change generic constraint handling in this phase.

---

# Phase 166: Inferred Generic Function Struct Type Arguments

Status: Complete.

## Goal

Lock in generic function type inference from struct-typed values.

## Semantics

- A call like `identity(point)` infers `T = Point` when `point` has struct type `Point`.
- The generated monomorphized function name preserves the struct name.
- Explicit generic calls, generic class instantiation, and constraints are unchanged.
- Existing valid C output remains stable except for newly covered inferred generic calls.

## Tests

- `struct Point { x: i32; }` passed through `identity(point)` emits `identity_Point`.
- Unknown and interface value diagnostics remain unchanged.

## Do Not

- Do not add interface dispatch.
- Do not change struct layout or struct semantics.

---

# Phase 167: Inferred Generic Function Class Type Arguments

Status: Complete.

## Goal

Lock in generic function type inference from concrete class values.

## Semantics

- A call like `identity(box)` infers `T = Box` when `box` has concrete class type `Box`.
- The generated monomorphized function name preserves the class name.
- Static class layout and existing class lowering remain unchanged.

## Tests

- `class Box { value: i32; }` passed through `identity(box)` emits `identity_Box`.
- Generic function inference still rejects unknown values with one root diagnostic.

## Do Not

- Do not add runtime class metadata.
- Do not add dynamic dispatch.

---

# Phase 168: Generic Function Constraint Satisfaction Diagnostics

Status: Complete.

## Goal

Report clear diagnostics when an inferred or explicit generic function type argument does not
satisfy an interface constraint.

## Semantics

- Generic constraints still name interfaces only.
- If `T extends Readable` and `Box` does not implement `Readable`, report a direct constraint
  failure instead of a cascade.
- If `Box implements Readable`, generic function instantiation is accepted.
- Diagnostics name the generic function, type parameter, concrete type, and required interface.

## Tests

- `read<Box>(box)` reports that `Box` does not satisfy `Readable`.
- `read(box)` with inferred `Box` reports the same root cause.
- Valid `Box implements Readable` still compiles.

## Do Not

- Do not create interface values.
- Do not add runtime vtables or dynamic dispatch.

---

# Phase 169: Generic Class Constraint Satisfaction Diagnostics

Status: Complete.

## Goal

Report clear diagnostics when generic class type arguments do not satisfy interface constraints.

## Semantics

- `Holder<Box>` checks `Box` against each interface constraint declared on `Holder<T>`.
- Invalid type arguments produce one root diagnostic naming the class, type parameter, concrete
  type, and required interface.
- Valid concrete classes that implement the interface remain accepted.

## Tests

- `Holder<Box>` rejects `Box` without `implements Readable`.
- `Holder<Box>` accepts `Box implements Readable`.
- Unknown type and interface value diagnostics remain unchanged.

## Do Not

- Do not implement borrowed interface values in this phase.
- Do not change generic function behavior in this phase.

---

# Phase 170: Borrowed Interface Type Syntax

Status: Complete.

## Goal

Introduce syntax for borrowed interface views without enabling runtime dispatch.

## Semantics

- Interface names remain invalid as owning value types.
- `Readable&` is accepted as borrowed interface syntax using TypeC's existing reference type
  spelling.
- `Ref<Readable>` is accepted as the canonical generic spelling for the same borrowed interface
  shape.
- A borrowed interface type is a non-owning view over existing concrete storage.
- This phase admits type syntax only; no conversion, method dispatch, vtable, or C lowering model is
  introduced.

## Tests

- Owning `Readable` values still report `Interface value type 'Readable' is not implemented`.
- `Readable&` parses and passes type validation.
- `Ref<Readable>` parses and passes type validation.

## Do Not

- Do not allocate boxes.
- Do not create runtime interface objects.
- Do not add dynamic dispatch.

---

# Phase 171: Borrowed Interface Conversion Diagnostics

Status: Complete.

## Goal

Allow explicit borrowed interface conversion from concrete values and reject invalid conversions
with clear diagnostics.

## Semantics

- A concrete reference can be used where a borrowed interface reference is expected only when the
  concrete type satisfies the interface method shape already required by TypeC interface checks.
- The borrowed value does not own storage and does not extend the lifetime of the source.
- Invalid conversions name the source type, target interface, and first missing method.
- This phase checks conversion diagnostics only; it does not emit interface-value C layout or method
  dispatch.

## Tests

- Borrowing `Box implements Readable` as borrowed `Readable` is accepted by the checker.
- Borrowing `Empty` as borrowed `Readable` is rejected with
  `Cannot borrow 'Empty' as interface 'Readable': missing method 'get'`.
- Existing owning interface diagnostics remain unchanged.

## Do Not

- Do not infer structural interface implementation.
- Do not allow hidden heap allocation.

---

# Phase 172: Borrowed Interface Method Call Lowering

Status: Complete.

## Goal

Lower method calls on borrowed interface values while preserving static, C-emittable semantics.

## Semantics

- Borrowed interface values lower to explicit non-owning fat values containing `void* self` and one
  function pointer per interface method.
- Concrete borrowed references converted to borrowed interface values use generated static shims.
- Method calls on borrowed interface values call the stored function pointer with `self` plus the
  method arguments.
- No JavaScript object, prototype, reflection, or hidden allocation is emitted.
- Direct class method calls remain unchanged.

## Tests

- Calling `readable.get()` on a borrowed `Readable` emits readable C using fixed-width TypeC types.
- Converting `Box&` to `Readable&` emits a `Box_as_Readable_get` shim.
- Missing method implementations are diagnosed before lowering.
- Existing direct class method calls remain unchanged.

## Do Not

- Do not implement owned boxed interfaces.
- Do not add GC or hidden lifetime extension.

---

# Phase 173: Default Parameter QoL

Status: Complete.

## Goal

Make default function parameters feel TypeScript-like while staying statically lowered.

## Semantics

- Default parameter expressions must be compile-time type-compatible with the parameter type.
- Calls omitting defaulted trailing arguments are rewritten at compile time.
- Defaults do not create overload objects or JavaScript-style `undefined` semantics.

## Tests

- `function add(a: i32, b: i32 = 1)` accepts `add(2)` and lowers as `add(2, 1)`.
- Non-trailing omitted parameters remain rejected unless later syntax is specified.
- Type mismatch in default value reports a direct diagnostic.

## Do Not

- Do not introduce implicit `undefined`.
- Do not evaluate defaults at runtime unless their expression semantics already require it.

---

# Phase 174: Rest Parameter QoL

Status: Complete.

## Goal

Support TypeScript-like rest parameters using explicit C-emittable array or slice representation.

## Semantics

- Rest parameters lower to a statically defined slice or pointer-length pair.
- Calls with rest arguments materialize compile-time-known aggregate arguments where possible.
- No varargs are used for TypeC functions unless declared as native extern C ABI.

## Tests

- `function sum(...values: i32[])` or the selected TypeC spelling lowers to fixed-width C.
- Passing zero, one, and many arguments is covered.
- Invalid element types produce one root diagnostic.

## Do Not

- Do not emit raw C varargs for normal TypeC functions.
- Do not allocate hidden arrays on the heap.

---

# Phase 175: Optional Record Fields

Status: Complete.

## Goal

Add TypeScript-like optional record fields with explicit TypeC optional storage semantics.

## Semantics

- Optional fields lower to explicit optional storage, not missing JavaScript properties.
- Reading an optional field returns an optional value.
- Record literals may omit optional fields; omitted fields lower to `None<T>`.
- Required fields are still enforced.

## Tests

- `type User = { id: i32; name?: u8*; }` accepts `{ id: 1 }`.
- Reading `user.name` has optional type.
- Missing required fields and wrong optional payload types report direct diagnostics.

## Do Not

- Do not add dynamic property presence checks.
- Do not introduce `undefined`.

---

# Phase 176: Re-exports and Module Aliasing QoL

Status: Complete.

## Goal

Improve module ergonomics with static re-exports and aliases.

## Semantics

- Re-exports are compile-time module graph operations only.
- Aliases rename imported symbols without runtime namespace objects.
- Cycles and missing exports remain diagnosed by the module loader.

## Tests

- `export { add } from "./math.tc"` or selected syntax re-exports declarations.
- `import { add as sum }` resolves statically.
- Duplicate aliases and ambiguous re-exports are rejected.

## Do Not

- Do not emit runtime module objects.
- Do not support dynamic import.

---

# Phase 177: Readonly Diagnostics and Inference Polish

Status: Complete.

## Goal

Make readonly behavior clearer and closer to TypeScript's developer experience while remaining
compile-time only.

## Semantics

- Readonly prevents assignment after initialization.
- Diagnostics identify the declaration site and the attempted write site.
- Inference preserves readonly field information through records, generic returns, and destructuring
  where already supported by the type model.

## Tests

- Writes to readonly class and record fields report source and target locations.
- Generic identity of a readonly record preserves readonly diagnostics after return.
- Destructuring does not accidentally drop readonly restrictions for borrowed storage.

## Do Not

- Do not emit runtime readonly metadata.
- Do not freeze objects or generate JS-like behavior.

---

# Phase 178: Array and Slice Helper QoL

Status: Complete.

## Goal

Provide common static helpers for arrays and slices without hidden allocation.

## Semantics

- Helpers are either compile-time intrinsics or standard library functions with explicit storage.
- Slice helpers operate on pointer-length pairs or the selected TypeC slice representation.
- Helper names and signatures use TypeC primitive names one-to-one with emitted C typedefs.

## Tests

- Length, indexing, slicing, and simple iteration helpers emit fixed-width C.
- Out-of-bounds static indexes report diagnostics.
- Helpers do not allocate unless the API explicitly takes an allocator or arena.

## Do Not

- Do not add JS Array methods with dynamic allocation semantics.
- Do not hide bounds or lifetime behavior.

---

# Phase 179: Optional Inference and Aggregate Literal Diagnostics

Status: Complete.

## Goal

Improve optional construction/inference and aggregate literal errors so TypeC code feels less noisy
while staying explicit.

## Semantics

- Optional constructors infer payload types from expected contexts when unambiguous.
- Aggregate literals use expected record, tuple, array, enum, or tagged union context when
  available.
- Ambiguous inference reports a diagnostic asking for an explicit type.

## Tests

- `const x: i32? = Some(1)` infers `Some<i32>` if syntax permits.
- Aggregate record literals report missing, extra, and mistyped fields with exact field names.
- Ambiguous `Some(value)` outside expected context remains rejected.

## Do Not

- Do not add implicit null or undefined.
- Do not guess types across ambiguous overload-like contexts.

---

# Phase 180: Rust-Like LSP Inlay Hints for Types and Generic Inference

Status: Complete.

## Goal

Expose compiler inference results in the LSP the way Rust Analyzer exposes inferred types and
generic parameters.

## Semantics

- The LSP reads inference data produced by the compiler pipeline; it does not duplicate type logic.
- Local declarations with inferred types can show type inlay hints.
- Generic calls with inferred type arguments can show virtual hints, e.g. `identity::<Point>(point)`
  style display or TypeC's selected display form.
- For declarations like `const name = expr`, the LSP can show `: InferredType`.
- For generic functions like `name<T>(...)`, the LSP can show inferred `<T>` arguments at call
  sites.

## Tests

- Inlay hints show inferred local variable types.
- Inlay hints show inferred generic function type arguments.
- Hover and signature help surface the same compiler-derived types.
- Hints update after document changes without stale cached semantic state.

## Do Not

- Do not duplicate checker or generic inference logic in the LSP.
- Do not make hints part of emitted C.
- Do not require VSCode-specific behavior.

---

# Phase 181: Rust-Like Diagnostic Rendering

Status: Complete.

## Goal

Provide Rust-style diagnostic output with detailed source context, labels, notes, and actionable
help.

## Semantics

- CLI diagnostics include file path, line, column, severity, primary span, source excerpt, and caret
  labels.
- Related spans are shown for declarations, inferred types, readonly origins, generic constraints,
  and interface implementation requirements.
- Diagnostics may include `note` and `help` messages when they are precise and actionable.
- LSP diagnostics carry matching related information so editors can show the same root cause.
- The final diagnostic presentation remains renderer-only; semantic checks still live in compiler
  phases.

## Tests

- Unknown identifiers show a primary source label and a suggested nearby declaration when available.
- Generic constraint failures show the call site, type argument, and interface constraint
  declaration.
- Readonly writes show both the write site and readonly declaration site.
- Borrowed interface failures show source type, target interface, and missing implementation.
- CLI snapshot tests validate stable Rust-like formatting.
- LSP tests validate related diagnostic information and code descriptions.

## Do Not

- Do not hide root-cause compiler diagnostics behind formatter-only text.
- Do not emit multiple duplicate diagnostics for the same invalid construct.
- Do not add editor-specific semantics.

---

# Phase 182: Stable Diagnostic Codes

Status: Complete.

Phase 182 adds stable diagnostic codes to rendered diagnostics.

Rules:

- Diagnostic codes are presentation metadata.
- Codes must not change parser, checker, lowering, or emitter semantics.
- CLI rendering prints coded diagnostics as `error[E####]: message`.
- LSP diagnostics expose the same code through the standard diagnostic `code` field.
- Related spans, notes, and help remain unchanged.

Initial coded diagnostic:

```txt
error[E0182]: Field 'x' is readonly
```

This keeps diagnostics precise and machine-readable without adding runtime behavior.

---

# Phase 183: Diagnostic Code Registry

Status: Complete.

Phase 183 centralizes stable diagnostic code metadata.

Rules:

- Diagnostic code strings are defined in one core registry module.
- Compiler phases reference named diagnostic code constants instead of raw code strings.
- LSP `codeDescription.href` points to the code-specific documentation URL when a code is present.
- Diagnostics without a code keep the generic diagnostics documentation URL.
- This phase is diagnostics-only and does not change language semantics or emitted C.

Example LSP metadata:

```json
{
  "code": "E0182",
  "codeDescription": { "href": "https://typec.dev/diagnostics/E0182" }
}
```

---

# Phase 184: Name Resolution Diagnostic Codes

Status: Complete.

Phase 184 assigns stable diagnostic codes to resolver diagnostics.

Rules:

- Unknown identifiers use `E0001`.
- Duplicate symbol declarations use `E0002`.
- Duplicate function implementations use `E0003`.
- Codes are attached where resolver diagnostics are created.
- CLI and LSP rendering continue to use the shared diagnostic metadata from earlier phases.
- This phase does not change name resolution semantics.

Examples:

```txt
error[E0001]: Unknown identifier 'missing'
error[E0003]: Duplicate function 'main'
```

---

# Phase 185: Type-Check Diagnostic Codes

Status: Complete.

Phase 185 assigns stable diagnostic codes to common checker diagnostics.

Rules:

- Function arity diagnostics use `E0100`.
- Call argument type diagnostics use `E0101`.
- Local initializer type diagnostics use `E0102`.
- Assignment type diagnostics use `E0103`.
- Return type diagnostics use `E0104`.
- Returning a value from `void` functions uses `E0105`.
- Bare returns from value-returning functions use `E0106`.
- Codes are metadata only and do not alter checker semantics.
- CLI and LSP presentation use the shared diagnostic renderer and code registry.

Example:

```txt
error[E0101]: Argument 1 type 'bool' is not assignable to 'i32'
```

---

# Phase 186: Aggregate Diagnostic Codes

Status: Complete.

Phase 186 assigns stable diagnostic codes to record aggregate diagnostics.

Rules:

- Record literal target mismatches use `E0200`.
- Duplicate record literal fields use `E0201`.
- Unknown record fields use `E0202`.
- Missing required record fields use `E0203`.
- Record field type mismatches use `E0204`.
- Invalid record spread operands use `E0205`.
- Record spread field type mismatches use `E0206`.
- Codes are metadata only and do not change aggregate typing, optional field behavior, spread
  lowering, or emitted C.

Example:

```txt
error[E0202]: Unknown field 'name' on type 'User'
```

---

# Phase 187: Slice Helper Diagnostic Codes

Status: Complete.

Phase 187 assigns stable diagnostic codes to array and slice helper diagnostics.

Rules:

- Wrong `slice` helper arity uses `E0300`.
- Non-integer `slice` indexes use `E0301`.
- Static `slice` start/end ordering failures use `E0302`.
- Static array `slice` bounds failures use `E0303`.
- Codes are metadata only and do not change array, slice, bounds, lowering, or emitted C semantics.

Example:

```txt
error[E0303]: slice end 3 is out of bounds for length 2
```

---

# Phase 188: Optional Constructor Diagnostic Codes

Status: Complete.

Phase 188 assigns stable diagnostic codes to optional constructor diagnostics.

Rules:

- Ambiguous `Some(...)` and `None()` constructor context failures use `E0400`.
- Optional constructor arity failures use `E0401`.
- Optional constructor value type mismatches use `E0402`.
- Codes are metadata only and do not change optional inference, contextual typing, lowering, or
  emitted C.

Example:

```txt
error[E0400]: Some requires an expected optional type or exactly one explicit type argument
```

---

# Phase 189: Module and Import Diagnostic Codes

Status: Complete.

Phase 189 assigns stable diagnostic codes to module loading and static import diagnostics.

Rules:

- Invalid import paths use `E0500`.
- Missing modules use `E0501`.
- Import cycles use `E0502`.
- Duplicate import aliases use `E0503`.
- Missing named exports use `E0504`.
- Ambiguous module exports use `E0505`.
- Missing default exports use `E0506`.
- Import path escape attempts use `E0507`.
- Codes are metadata only and do not change module resolution, parsing, checking, lowering, or
  emitted C.

Example:

```txt
error[E0504]: Module does not export 'hidden'
```

---

# Phase 190: Control-Flow Diagnostic Codes

Status: Complete.

Phase 190 assigns stable diagnostic codes to control-flow diagnostics.

Rules:

- Non-boolean `if` and loop conditions use `E0600`.
- Invalid `for-of` iterables use `E0601`.
- Invalid `for-in` iterables use `E0602`.
- `break` outside a valid switch context uses `E0603`.
- `continue` outside a loop uses `E0604`.
- `defer` without a call expression uses `E0605`.
- Codes are metadata only and do not change control-flow semantics, checking, lowering, or emitted
  C.

Example:

```txt
error[E0600]: If condition type 'i32' is not assignable to 'bool'
```

---

# Phase 191: Index Expression Diagnostic Codes

Status: Complete.

Phase 191 assigns stable diagnostic codes to array, slice, tuple, and non-indexable expression
diagnostics.

Rules:

- Indexing a non-indexable value uses `E0700`.
- Non-integer array and slice indexes use `E0701`.
- Static fixed-array index bounds failures use `E0702`.
- Non-literal tuple indexes use `E0703`.
- Tuple index bounds failures use `E0704`.
- Codes are metadata only and do not change expression typing, bounds rules, lowering, or emitted C.

Example:

```txt
error[E0702]: Array index 2 is out of bounds for length 2
```

---

# Phase 192: Field Access Diagnostic Codes

Status: Complete.

Phase 192 assigns stable diagnostic codes to field access diagnostics.

Rules:

- Field access on non-record values uses `E0800`.
- Unknown record field access uses `E0801`.
- Private or protected field access violations use `E0802`.
- Invalid fixed-array helper field access uses `E0803`.
- Invalid slice helper field access uses `E0804`.
- Unsized array `.length()` access uses `E0805`.
- Codes are metadata only and do not change expression typing, class access rules, lowering, or
  emitted C.

Example:

```txt
error[E0801]: Unknown field 'name' on type 'User'
```

---

# Phase 193: Optional Operator Diagnostic Codes

Status: Complete.

Phase 193 assigns stable diagnostic codes to optional-related expression operator diagnostics.

Rules:

- Non-null assertion on a non-optional value uses `E0900`.
- Nullish coalescing with a non-optional left operand uses `E0901`.
- Nullish coalescing fallback type mismatches use `E0902`.
- Optional chaining on a non-optional operand uses `E0903`.
- Unknown optional method calls use `E0904`.
- Codes are metadata only and do not change optional typing, expression checking, lowering, or
  emitted C.

Example:

```txt
error[E0901]: Nullish coalescing requires optional left operand, got 'i32'
```

---

# Phase 194: Operator Diagnostic Codes

Status: Complete.

Phase 194 assigns stable diagnostic codes to unary and binary operator diagnostics.

Rules:

- Binary operand type mismatch uses `E1000`.
- Logical binary operand failures use `E1001`.
- Shift left operand integer failures use `E1002`.
- Shift count unsigned integer failures use `E1003`.
- Unsigned right-shift left operand failures use `E1004`.
- Static shift count bounds failures use `E1005`.
- Bitwise binary operand failures use `E1006`.
- Numeric binary operand failures use `E1007`.
- Remainder operand failures use `E1008`.
- Static integer divide-by-zero failures use `E1009`.
- Logical not operand failures use `E1010`.
- Bitwise not operand failures use `E1011`.
- Numeric unary operand failures use `E1012`.
- Codes are metadata only and do not change operator typing, constant evaluation, lowering, or
  emitted C.

Example:

```txt
error[E1000]: Cannot apply '+' to 'i32' and 'bool'
```

---

# Phase 195: Literal and Constant Diagnostic Codes

Status: Complete.

Phase 195 assigns stable diagnostic codes to literal, constant range, and C string literal
diagnostics.

Rules:

- Integer literal range failures use `E1100`.
- Float literal range failures use `E1101`.
- Compile-time integer constant range failures use `E1102`.
- Compile-time float constant range failures use `E1103`.
- String literal target type failures use `E1104`.
- String literal fixed-array length failures use `E1105`.
- Codes are metadata only and do not change literal typing, constant evaluation, lowering, or
  emitted C.

Example:

```txt
error[E1100]: Integer literal '300' is out of range for 'u8'
```

---

# Phase 196: Function Declaration Diagnostic Codes

Status: Complete.

Phase 196 assigns stable diagnostic codes to function declaration, overload, entrypoint, and unknown
function call diagnostics.

Rules:

- Non-extern variadic functions use `E1200`.
- Variadic extern functions without a fixed parameter use `E1201`.
- Extern `main` declarations use `E1202`.
- `main` declarations with parameters use `E1203`.
- `main` declarations with a non-`i32` return type use `E1204`.
- Overload declarations after an implementation use `E1205`.
- Overload groups without exactly one implementation use `E1206`.
- Calls to unknown functions use `E1207`.
- Codes are metadata only and do not change overload resolution, entrypoint rules, lowering, or
  emitted C.

Example:

```txt
error[E1204]: Function 'main' must return 'i32'
```

---

# Phase 197: Generic Diagnostic Codes

Status: Complete.

Phase 197 assigns stable diagnostic codes to generic parameter, explicit type argument, and generic
constraint diagnostics.

Rules:

- Duplicate generic parameters use `E1300`.
- Non-interface generic constraint shapes use `E1301`.
- Named generic constraints that resolve to non-interface declarations use `E1302`.
- Unknown generic constraint or type argument names use `E1303`.
- Interface value type arguments use `E1304`.
- Explicit type arguments on unknown generic functions use `E1305`.
- Explicit generic type argument arity failures use `E1306`.
- Invalid instantiated generic constraints use `E1307`.
- Unsatisfied generic constraints use `E1308`.
- Unsatisfied generic constraints caused by missing interface methods use `E1309`.
- Codes are metadata only and do not change generic inference, constraint checking,
  monomorphization, lowering, or emitted C.

Example:

```txt
error[E1300]: Duplicate generic parameter 'T'
```

---

# Phase 198: Enum, Tagged Union, and Switch Diagnostic Codes

Status: Complete.

Phase 198 assigns stable diagnostic codes to enum declarations, tagged union declarations, tagged
union constructors/accessors, and switch statement diagnostics.

Rules:

- Duplicate enum members use `E1400`.
- Non-integer enum member initializers use `E1401`.
- Invalid enum backing types use `E1402`.
- Enum member values outside the backing type range use `E1403`.
- Duplicate tagged union variants use `E1404`.
- Unknown tagged union variants use `E1405`.
- Payload access on payload-less variants uses `E1406`.
- Tagged union constructor arity failures use `E1407`.
- Tagged union constructor payload type mismatches use `E1408`.
- Non-switchable switch expression types use `E1409`.
- Switch case label type mismatches use `E1410`.
- Duplicate switch case labels use `E1411`.
- Codes are metadata only and do not change enum layout, tagged union layout, switch checking,
  lowering, or emitted C.

Example:

```txt
error[E1400]: Duplicate enum member 'A'
```

---

# Phase 199: Type Reference Diagnostic Codes

Status: Complete.

Phase 199 assigns stable diagnostic codes to invalid type reference positions, unknown value types,
invalid aggregate type shapes, and array return type diagnostics.

Rules:

- Union type syntax outside accepted alias positions uses `E1500`.
- Intersection type syntax outside accepted alias positions uses `E1501`.
- Conditional type syntax outside accepted alias positions uses `E1502`.
- Indexed access type syntax outside mapped aliases uses `E1503`.
- Mapped type syntax outside accepted alias positions uses `E1504`.
- `keyof` type syntax outside accepted alias positions uses `E1505`.
- `typeof` type syntax outside accepted alias positions uses `E1506`.
- Uninstantiated generic type names use `E1507`.
- Unknown type names use `E1508`.
- Owning interface value type references use `E1509`.
- Optional `void` element types use `E1510`.
- Duplicate record type fields use `E1511`.
- Record fields with inferred array types use `E1512`.
- Pointer-to-array type shapes use `E1513`.
- Reference-to-array type shapes use `E1514`.
- Reference-to-void type shapes use `E1515`.
- Non-positive fixed array sizes use `E1516`.
- Function return array types use `E1517`.
- Codes are metadata only and do not change type validation, lowering, or emitted C.

Example:

```txt
error[E1508]: Unknown type 'Missing'
```

---

# Phase 200: Lexer Diagnostic Codes

Status: Complete.

Phase 200 assigns stable diagnostic codes to lexer diagnostics.

Rules:

- Unexpected characters use `E1600`.
- Unterminated block comments use `E1601`.
- Invalid numeric separator placement uses `E1602`.
- Unterminated string literals use `E1603`.
- Unterminated template literals use `E1604`.
- Invalid static template interpolation uses `E1605`.
- Codes are metadata only and do not change tokenization, parsing, checking, lowering, or emitted C.

Example:

```txt
error[E1600]: Unexpected character '$'
```

---

# Phase 201: Parser Diagnostic Codes

Status: Complete.

Phase 201 assigns stable diagnostic codes to parser syntax and declaration modifier diagnostics.

Rules:

- General parser syntax errors use `E1700`.
- Exported import declarations use `E1701`.
- Extern import declarations use `E1702`.
- Extern type alias declarations use `E1703`.
- Extern constant declarations use `E1704`.
- Extern enum declarations use `E1705`.
- Extern class declarations use `E1706`.
- Extern interface declarations use `E1707`.
- Exported extern function declarations use `E1708`.
- Codes are metadata only and do not change parsing, checking, lowering, or emitted C.

Example:

```txt
error[E1700]: Expected identifier
```

---

# Phase 202: C ABI and Symbol Diagnostic Codes

Status: Complete.

Phase 202 assigns stable diagnostic codes to C ABI compatibility and emitted C symbol collision
diagnostics.

Rules:

- C ABI incompatible exported or extern function return types use `E1800`.
- C ABI incompatible exported or extern function parameter types use `E1801`.
- Duplicate emitted C function symbols use `E1802`.
- Duplicate emitted C constant symbols use `E1803`.
- Duplicate emitted C type symbols use `E1804`.
- Duplicate emitted C ordinary symbols use `E1805`.
- Codes are metadata only and do not change ABI compatibility rules, symbol naming, lowering, or
  emitted C.

Example:

```txt
error[E1800]: Extern function 'pair' return type '[i32, i32]' is not C ABI compatible
```

---

# Phase 203: Array Literal and Fill Diagnostic Codes

Status: Complete.

Phase 203 assigns stable diagnostic codes to array literal and `Array.fill` diagnostics.

Rules:

- Array literals without an expected array context use `E1900`.
- Array literals assigned to non-array targets use `E1901`.
- Empty array literals that cannot be inferred use `E1902`.
- Array literal element type mismatches use `E1903`.
- Fixed array literal length mismatches use `E1904`.
- `Array.fill` without an expected fixed array target uses `E1905`.
- `Array.fill` initializer arity errors use `E1906`.
- `Array.fill` callback parameter arity errors use `E1907`.
- `Array.fill` initializer type mismatches use `E1908`.
- Codes are metadata only and do not change array inference, type checking, lowering, or emitted C.

Example:

```txt
error[E1904]: Array length 3 is not assignable to 'i32[2]'
```

---

# Phase 204: Declaration and Inference Diagnostic Codes

Status: Complete.

Phase 204 assigns stable diagnostic codes to declaration-shape and local inference diagnostics.

Rules:

- Array variable initializers that are not valid array initializers use `E2000`.
- Local variables whose type cannot be inferred without an annotation use `E2001`.
- Type aliases that depend on later type aliases use `E2002`.
- Callback expression type mismatches use `E2003`.
- Codes are metadata only and do not change declaration ordering, inference, callback assignability,
  lowering, or emitted C.

Example:

```txt
error[E2002]: Type alias 'A' cannot depend on 'B' before it is declared
```

---

# Phase 205: Conditional and Statement Diagnostic Codes

Status: Complete.

Phase 205 assigns stable diagnostic codes to conditional expression, expression statement, record
inference, and missing-return diagnostics.

Rules:

- Expression statements that are not calls use `E2100`.
- Conditional expression conditions that are not `bool` use `E2101`.
- Conditional expression branch type mismatches use `E2102`.
- Record literal local inference with spread fields uses `E2103`.
- Non-void functions that can fall through without returning use `E2104`.
- Codes are metadata only and do not change expression typing, record inference, control-flow
  analysis, lowering, or emitted C.

Example:

```txt
error[E2100]: Expression statements must be function calls
```

---

# Phase 206: Interface and Value Type Diagnostic Codes

Status: Complete.

Phase 206 assigns stable diagnostic codes to interface method, borrowed interface conversion, and
invalid void value diagnostics.

Rules:

- Duplicate interface methods use `E2200`.
- Borrowed interface conversions missing required methods use `E2201`.
- Value declarations or type positions that cannot use `void` as a value type use `E2202`.
- Codes are metadata only and do not change interface checking, borrowed interface conversion,
  value-type validation, lowering, or emitted C.

Example:

```txt
error[E2201]: Cannot borrow 'Empty' as interface 'Readable': missing method 'get'
```

---

# Phase 207: Pointer, Arena, Return Inference, and Constant Diagnostic Codes

Status: Complete.

Phase 207 assigns stable diagnostic codes to pointer operations, arena builtin calls, inferred
function return diagnostics, and compile-time constant expression diagnostics.

Rules:

- Taking an address of a non-addressable expression uses `E2300`.
- Dereferencing a non-pointer-like expression uses `E2301`.
- `arenaAlloc` without an expected `SafePtr<T>` target uses `E2302`.
- Arena builtin arity errors use `E2303`.
- Arena builtin argument type mismatches use `E2304`.
- Mixing bare returns with inferred non-void return types uses `E2305`.
- Return type mismatches during function return inference use `E2306`.
- Non-constant expressions in compile-time constants use `E2307`.
- Codes are metadata only and do not change pointer semantics, arena builtin semantics, return
  inference, constant evaluation, lowering, or emitted C.

Example:

```txt
error[E2307]: Expression is not valid in a compile-time constant
```

---

# Phase 208: Assignment Target Diagnostic Codes

Status: Complete.

Phase 208 assigns stable diagnostic codes to assignment and increment/decrement target diagnostics.

Rules:

- Assigning to an immutable `const` root uses `E2400`.
- Assigning to a whole array variable uses `E2401`.
- Increment and decrement applied to non-integer targets use `E2402`.
- Assignment type mismatches continue to use `E0103`.
- Codes are metadata only and do not change mutability checks, array assignment rules,
  increment/decrement typing, lowering, or emitted C.

Example:

```txt
error[E2400]: Cannot assign to const 'value'
```

---

# Phase 209: Tuple and Basic Expression Diagnostic Codes

Status: Complete.

Phase 209 assigns stable diagnostic codes to tuple literal and basic expression diagnostics.

Rules:

- Tuple literal element type mismatches use `E2500`.
- Tuple literal length mismatches use `E2501`.
- String literals used without an expected C string target use `E2502`.
- Unknown identifiers reported by expression checking use existing `E0001`.
- Codes are metadata only and do not change tuple typing, string literal contextual typing, name
  resolution, lowering, or emitted C.

Example:

```txt
error[E2501]: Tuple literal length 1 does not match expected length 2
```

---

# Phase 210: Arrow Function Diagnostic Codes

Status: Complete.

Phase 210 assigns stable diagnostic codes to arrow function diagnostics.

Rules:

- Arrow functions without an expected function type use `E2600`.
- Arrow function parameter count mismatches use `E2601`.
- Arrow functions that capture locals use `E2602`.
- Codes are metadata only and do not change callback typing, capture rejection, lowering, or emitted
  C.

Example:

```txt
error[E2600]: Arrow functions require an expected function type
```

---

# Phase 211: Class Lowering Diagnostic Codes

Status: Complete.

Phase 211 assigns stable diagnostic codes to class lowering diagnostics.

Rules:

- Invalid class generic constraints use `E2700` or `E2701`.
- Duplicate class generic parameters use `E2702`.
- Generic class type-argument count mismatches use `E2703`.
- Unsatisfied class/interface constraints use `E2704`.
- Invalid class type arguments use `E2705` or `E2706`.
- Class inheritance diagnostics use `E2707` through `E2710`.
- Class implements diagnostics use `E2711` through `E2713`.
- Codes are metadata only and do not change class layout, generic class instantiation, inheritance
  lowering, interface checks, or emitted C.

Example:

```txt
error[E2709]: Unknown base class 'Missing'
```

---

# Phase 212: C Header Diagnostic Codes

Status: Complete.

Phase 212 assigns stable diagnostic codes to C header import diagnostics.

Rules:

- Unsupported C header types use `E2800`.
- clang invocation and JSON decoding diagnostics use `E2801` and `E2802`.
- Missing typedef/record declarations and fields use `E2803` and `E2804`.
- Malformed clang AST nodes use `E2805`.
- Unsupported function type spellings use `E2806`.
- Unsupported record array field types use `E2807`.
- Codes are metadata only and do not change clang invocation, header filtering, type mapping, extern
  generation, module loading, or emitted C.

Example:

```txt
error[E2800]: Unsupported C type '__unsupported_t'
```

---

# Phase 213: Project Configuration Diagnostic Codes

Status: Complete.

Phase 213 assigns stable diagnostic codes to JSON and project configuration diagnostics.

Rules:

- Invalid JSON uses `E2900`.
- JSON values that must be records use `E2901`.
- Unknown JSON keys use `E2902`.
- Invalid `project.json` dependencies object shape uses `E2903`.
- Invalid dependency aliases use `E2904`.
- Invalid dependency targets use `E2905`.
- Invalid `project.json` compiler object shape uses `E2906`.
- Invalid compiler flag list shape uses `E2907`.
- Rejected compiler flags use `E2908`.
- Codes are metadata only and do not change project discovery, dependency resolution, compiler flag
  validation, module loading, or emitted C.

Example:

```txt
error[E2908]: project.json compiler.flags cannot override the C standard
```

---

# Phase 214: Expression Helper Diagnostic Codes

Status: Complete.

Phase 214 assigns stable diagnostic codes to expression and destructuring helper diagnostics.

Rules:

- Record rest source and field diagnostics use `E3000` and `E3001`.
- Array destructuring source and arity diagnostics use `E3002` and `E3003`.
- Invalid numeric casts use `E3004`.
- Unsatisfied `satisfies` expressions use `E3005`.
- Overload resolution failures use `E3006` or `E3007`.
- Invalid method-call forms use `E3008` through `E3010`.
- Tagged-union narrowing mismatches use `E3011`.
- Codes are metadata only and do not change expression typing, overload resolution, destructuring,
  narrowing, lowering, or emitted C.

Example:

```txt
error[E3005]: Type 'i32' does not satisfy 'u8'
```

---

# Phase 215: JSON Value Diagnostic Codes

Status: Complete.

Phase 215 assigns stable diagnostic codes to shared JSON value diagnostics.

Rules:

- JSON text value validation uses `E3100` when a value is not text.
- Header-specific JSON AST diagnostics continue to use the C header diagnostic range.
- Codes are metadata only and do not change JSON parsing, project configuration, C header import
  behavior, or emitted C.

Example:

```txt
error[E3100]: expected text
```

---

# Phase 216: Parameter and Variadic Diagnostic Codes

Status: Complete.

Phase 216 assigns stable diagnostic codes to parameter default and C variadic argument diagnostics.

Rules:

- Required parameters after optional/default parameters use `E3200`.
- Default parameter type mismatches use `E3201`.
- Non-ABI-compatible C variadic arguments use `E3202`.
- Codes are metadata only and do not change parameter typing, call-site rewriting, C ABI checks,
  lowering, or emitted C.

Example:

```txt
error[E3201]: Default value type 'bool' is not assignable to parameter 'value' type 'i32'
```

---

# Phase 217: Roadmap Documentation Cleanup

Status: Complete.

Phase 217 aligns user-facing roadmap documentation with completed implementation phases.

Rules:

- `README.md` reported Phase 217 as the latest completed phase when this phase landed.
- The README roadmap no longer lists completed phases as upcoming work.
- Interface documentation distinguishes explicit borrowed `Interface&` views from rejected owning
  interface values and JavaScript object dispatch.
- Documentation changes are descriptive only and do not change parsing, checking, lowering, emitted
  C, diagnostics, or LSP behavior.

---

# Phase 218: Feature Status Documentation Cleanup

Status: Complete.

Phase 218 aligns feature support documentation with implemented TypeScript-like ergonomics.

Rules:

- README feature rows accurately describe optional constructor inference, scalar aliases, optional
  record fields, default/rest parameters, re-exports, borrowed interfaces, and array/slice helpers.
- Language documentation describes contextual `Some`/`None` inference and current import/type alias
  support.
- TypeScript feature analysis no longer lists implemented static features as missing.
- Documentation changes are descriptive only and do not change parsing, checking, lowering, emitted
  C, diagnostics, or LSP behavior.

---

# Phase 219: Named Generic Argument Inference

Status: Complete.

Phase 219 improves generic function inference through named generic type arguments.

Rules:

- Generic function inference binds type parameters that appear inside named type arguments, such as
  `Optional<T>`.
- Generic function substitution rewrites nested type arguments inside named type references.
- Inference remains static and monomorphic; it does not add JavaScript runtime generics, reflection,
  or dynamic dispatch.
- Ambiguous or underconstrained generic calls still require explicit type arguments.

Example:

```ts
function keep<T>(value: Optional<T>): Optional<T> {
  return value;
}

const maybe: i32? = Some(7);
const value: i32? = keep(maybe);
```

---

# Phase 220: Named Generic Class Type Substitution

Status: Complete.

Phase 220 completes named generic type substitution for generic class instantiation.

Rules:

- Generic class substitutions rewrite type parameters that appear inside named type arguments, such
  as `Optional<T>`.
- Generic class type rewriting preserves static monomorphic lowering and emits only concrete C
  structs/functions.
- This does not add runtime generics, reflection, dynamic dispatch, or JavaScript object semantics.
- Ambiguous generic class construction still requires explicit type arguments or a typed context.

Example:

```ts
class Box<T> {
  value: Optional<T>;
  constructor(value: Optional<T>) { this.value = value; }
  get(): Optional<T> { return this.value; }
}

const box = new Box<i32>(Some(7));
const value: i32? = box.get();
```

---

# Phase 221: Named Generic Class Constructor Inference

Status: Complete.

Phase 221 improves generic class constructor inference through named generic type arguments.

Rules:

- Generic class constructor inference binds type parameters inside named type arguments, such as
  `Optional<T>`.
- Constructor inference can use typed local arguments and recursively match nested named type
  arguments.
- Generic classes remain statically monomorphized; this does not add runtime generics, reflection,
  dynamic dispatch, or JavaScript object semantics.
- Ambiguous or underconstrained generic class construction still requires explicit type arguments or
  a typed context.

Example:

```ts
class Box<T> {
  value: Optional<T>;
  constructor(value: Optional<T>) { this.value = value; }
}

const maybe: i32? = Some(7);
const box = new Box(maybe);
```

---

# Phase 222: TypeScript Type-System Roadmap Expansion

Status: Complete.

Phase 222 expands the documented TODO list for TypeScript-like type-system work that can fit TypeC's
static, deterministic, C-emittable model.

Rules:

- This phase is documentation-only.
- No parser, checker, lowering, emitter, diagnostic, LSP, ABI, or runtime semantics change.
- Future TypeScript-like type-system work must be documented as an implementation phase before code
  changes land.
- Future work must keep JavaScript runtime baggage out of TypeC: no `any`, prototypes, hidden heap
  allocation, dynamic property maps, implicit `null`/`undefined`, truthiness, or JS module objects.

---

# Phase 223: Generic Type Alias Instantiation

Status: Complete.

Phase 223 adds a first static implementation of generic type aliases.

Rules:

- Type aliases may declare generic parameters using TypeScript-like syntax:

  ```ts
  type Box<T> = { value: T };
  ```

- References to generic type aliases must provide explicit type arguments.
- Generic type alias references are monomorphized into concrete non-generic aliases before type
  checking.
- Type parameters are substituted recursively through nested type references.
- Generic type alias templates are not emitted as C; only concrete instantiations are emitted.
- This phase does not add alias constraints, inferred alias arguments, distributive conditional
  behavior, type-level `infer`, runtime generics, reflection, or JavaScript object semantics.

Example:

```ts
type Box<T> = { value: T };

function main(): i32 {
  const box: Box<i32> = { value: 1 };
  return box.value;
}
```

---

# Phase 224: Nested Generic Type Alias Instantiation

Status: Complete.

Phase 224 expands generic type alias instantiation so alias bodies can reference other generic type
aliases.

Rules:

- Instantiated generic type alias bodies are recursively rewritten for nested generic alias
  references.
- Nested generic aliases emit required concrete aliases before aliases that depend on them.
- Monomorphization remains static and finite for explicitly referenced aliases.
- This phase does not add alias-to-alias flattening, alias constraints, inferred alias arguments,
  recursive aliases, distributive conditional behavior, runtime generics, reflection, or JavaScript
  object semantics.

Example:

```ts
type Box<T> = { value: T };
type Holder<T> = { box: Box<T> };

function main(): i32 {
  const holder: Holder<i32> = { box: { value: 1 } };
  return holder.box.value;
}
```

---

# Phase 225: Generic Type Alias Interface Constraints

Status: Complete.

Phase 225 adds first-pass interface constraints for generic type aliases.

Rules:

- Generic type alias parameters may use `extends InterfaceName` constraints.
- Constraint targets must be named interfaces.
- Type arguments satisfy an alias interface constraint when they name a class that explicitly
  implements the interface.
- Unsatisfied alias constraints produce generic constraint diagnostics before the alias is emitted.
- This phase does not add record-shape constraints, inferred alias type arguments, structural
  interface conversion, owned interface values, hidden vtables, or JavaScript object semantics.

Example:

```ts
interface Readable {
  get(): i32;
}
class Box implements Readable {
  get(): i32 {
    return 1;
  }
}

type Holder<T extends Readable> = { flag: bool };
const holder: Holder<Box> = { flag: true };
```

---

# Phase 226: Generic Type Alias Record-Shape Constraints

Status: Complete.

Phase 226 adds first-pass static record-shape constraints for generic type aliases.

Rules:

- Generic type alias parameters may use static record constraints:

  ```ts
  type Holder<T extends { id: i32 }> = { value: T };
  ```

- A type argument satisfies the constraint when it has all required fields with matching static
  TypeC types.
- Concrete record aliases and class fields may satisfy record-shape constraints.
- Constraint checks remain compile-time only and do not add structural interface conversion,
  JavaScript property lookup, dynamic property maps, hidden allocation, or runtime reflection.
- This phase does not add inferred alias arguments, optional/readonly modifier reasoning in
  constraints, recursive structural constraints, or owned interface values.

Example:

```ts
type Point = { id: i32; x: i32 };
type Holder<T extends { id: i32 }> = { value: T };

const holder: Holder<Point> = { value: { id: 1, x: 2 } };
```

---

# Phase 227: Generic Type Alias Record Constraint Diagnostics

Status: Complete.

Phase 227 improves diagnostics for generic type alias record-shape constraints.

Rules:

- Missing required fields report the first missing field at the alias instantiation site.
- Field type mismatches report the field name, actual static type, and required static type.
- Diagnostics still use the existing generic constraint diagnostic category.
- This phase does not add optional/readonly modifier reasoning, recursive structural constraints,
  structural interface conversion, owned interface values, or runtime reflection.

Examples:

```ts
type Point = { x: i32 };
type Holder<T extends { id: i32 }> = { value: T };

const holder: Holder<Point> = { value: { x: 1 } };
```

Reports:

```text
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'id' for record constraint
```

---

# Phase 228: Generic Type Alias Optional Record Constraints

Status: Complete.

Phase 228 adds optional-field reasoning to generic type alias record-shape constraints.

Rules:

- Optional fields in a record constraint may be absent from the type argument shape.
- If an optional constrained field is present, its static type must match the constrained field
  type.
- A required constrained field is not satisfied by an optional field in the type argument shape.
- Diagnostics report when an optional field is used where the constraint requires a required field.
- This phase does not add readonly modifier reasoning, recursive structural constraints, structural
  interface conversion, owned interface values, or runtime reflection.

Examples:

```ts
type Point = { x: i32 };
type Holder<T extends { id?: i32 }> = { value: T };

const holder: Holder<Point> = { value: { x: 1 } };
```

---

# Phase 229: Generic Type Alias Readonly Record Constraints

Status: Complete.

Phase 229 adds readonly-field reasoning to generic type alias record-shape constraints.

Rules:

- A readonly constrained field may be satisfied by a readonly or mutable field in the type argument
  shape.
- A mutable constrained field is not satisfied by a readonly field in the type argument shape.
- Diagnostics report when a readonly field is used where the constraint requires a mutable field.
- This phase does not add recursive structural constraints, structural interface conversion, owned
  interface values, or runtime reflection.

Examples:

```ts
type Point = { id: i32 };
type Holder<T extends { readonly id: i32 }> = { value: T };

const holder: Holder<Point> = { value: { id: 1 } };
```

---

# Phase 230: Generic Type Alias Nested Record Constraints

Status: Complete.

Phase 230 adds nested record-field matching for generic type alias record-shape constraints.

Rules:

- A constrained record field whose type is another record shape is checked structurally against the
  matching field in the type argument shape.
- Nested actual fields may name concrete record aliases or classes with matching fields.
- Nested checks preserve existing optional and readonly field rules.
- Diagnostics report the containing field mismatch at the alias instantiation site.
- This phase does not add recursive aliases, recursive structural constraints, structural interface
  conversion, owned interface values, or runtime reflection.

Example:

```ts
type Meta = { id: i32; tag: i32 };
type Point = { meta: Meta; x: i32 };
type Holder<T extends { meta: { id: i32 } }> = { value: T };

const holder: Holder<Point> = { value: { meta: { id: 1, tag: 2 }, x: 3 } };
```

---

# Phase 231: Generic Type Alias Nested Record Constraint Diagnostics

Status: Complete.

Phase 231 improves diagnostics for nested generic type alias record-shape constraints.

Rules:

- Nested record-shape mismatches report dotted field paths such as `meta.id`.
- Missing nested fields, optional-vs-required mismatches, readonly-vs-mutable mismatches, and type
  mismatches all use the nested path in the diagnostic message.
- Diagnostics still report at the alias instantiation site and use the existing generic constraint
  diagnostic category.
- This phase does not add recursive aliases, recursive structural constraints, structural interface
  conversion, owned interface values, or runtime reflection.

Example:

```ts
type Meta = { tag: i32 };
type Point = { meta: Meta };
type Holder<T extends { meta: { id: i32 } }> = { value: T };

const holder: Holder<Point> = { value: { meta: { tag: 1 } } };
```

Reports:

```text
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.id' for record constraint
```

---

# Phase 232: Generic Type Alias Exact Named Constraints

Status: Complete.

Phase 232 adds exact named-type constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact named primitive, class,
  or concrete type alias:

  ```ts
  type Holder<T extends i32> = { value: T };
  ```

- Interface-name constraints keep their existing nominal interface semantics.
- Non-interface named constraints require the type argument name and concrete type arguments to
  match exactly.
- Unknown named constraints remain invalid constraints.
- This phase does not add subtyping, structural conversion, alias flattening, implicit primitive
  widening, owned interface values, or runtime reflection.

Example:

```ts
type Id = i32;
type Holder<T extends Id> = { value: T };

const holder: Holder<Id> = { value: 1 };
```

---

# Phase 233: Generic Type Alias Exact Generic-Alias Constraints

Status: Complete.

Phase 233 extends exact named constraints to instantiated generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact instantiated generic
  alias:

  ```ts
  type Box<T> = { value: T };
  type Holder<T extends Box<i32>> = { value: T };
  ```

- The type argument must match the instantiated generic alias exactly after alias monomorphization.
- Constraint arity is checked through existing invalid-constraint diagnostics.
- This phase does not add alias flattening, variance, subtyping, inferred alias arguments,
  structural conversion, owned interface values, or runtime reflection.

Example:

```ts
type Box<T> = { value: T };
type Holder<T extends Box<i32>> = { value: T };

const holder: Holder<Box<i32>> = { value: { value: 1 } };
```

---

# Phase 234: Generic Type Alias Exact Fixed-Array Constraints

Status: Complete.

Phase 234 adds exact fixed-array constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact fixed-array type:

  ```ts
  type Holder<T extends i32[2]> = { value: T };
  ```

- The type argument must match the element type and fixed length exactly.
- Matching is static and compile-time only.
- This phase does not add inferred-array field support, dynamic arrays, array subtyping, variance,
  alias flattening, structural conversion, or runtime metadata.

Example:

```ts
type Holder<T extends i32[2]> = { value: T };

const holder: Holder<i32[2]> = { value: [1, 2] };
```

---

# Phase 235: Generic Type Alias Exact Tuple Constraints

Status: Complete.

Phase 235 adds exact tuple constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact tuple type:

  ```ts
  type Holder<T extends [i32, u32]> = { value: T };
  ```

- The type argument must match tuple length and element types exactly.
- Matching is static and compile-time only.
- This phase does not add tuple subtyping, variadic tuples, tuple spreading in type positions, alias
  flattening, variance, structural conversion, or runtime metadata.

Example:

```ts
type Holder<T extends [i32, u32]> = { value: T };

const holder: Holder<[i32, u32]> = { value: [1, 2] };
```

---

# Phase 236: Generic Type Alias Exact Optional Constraints

Status: Complete.

Phase 236 adds exact optional constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact optional type:

  ```ts
  type Holder<T extends i32?> = { value: T };
  ```

- The type argument must match the optional element type exactly.
- Matching is static and compile-time only.
- Optional values remain explicit `Some` / `None` storage; this phase does not add JavaScript `null`
  or `undefined`, optional subtyping, alias flattening, variance, structural conversion, or runtime
  metadata.

Example:

```ts
type Holder<T extends i32?> = { value: T };

const holder: Holder<i32?> = { value: Some(1) };
```

---

# Phase 237: Generic Type Alias Exact Pointer-Like Constraints

Status: Complete.

Phase 237 adds exact pointer-like constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact pointer, reference, safe
  pointer, or slice type:

  ```ts
  type PtrHolder<T extends i32*> = { value: T };
  type RefHolder<T extends i32&> = { value: T };
  type SafeHolder<T extends SafePtr<i32>> = { value: T };
  type SliceHolder<T extends Slice<i32>> = { value: T };
  ```

- The type argument must match the pointed-to, referenced, safe-pointer, or slice element type
  exactly.
- Matching is static and compile-time only.
- This phase does not add pointer subtyping, mutability polymorphism, lifetime inference, alias
  flattening, variance, structural conversion, dynamic slices, or runtime metadata.

Example:

```ts
type Holder<T extends i32*> = { value: T };

function take(value: Holder<i32*>): i32 {
  return 0;
}
```

---

# Phase 238: Generic Type Alias Exact Function-Type Constraints

Status: Complete.

Phase 238 adds exact function-type constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact function type:

  ```ts
  type Holder<T extends (value: i32) => i32> = { value: T };
  ```

- The type argument must match parameter count, parameter types, and return type exactly.
- Function parameter names are not part of constraint identity.
- Matching is static and compile-time only.
- This phase does not add callable values beyond existing function-pointer type support, function
  subtyping, variance, overload constraint matching, closure captures, alias flattening, structural
  conversion, or runtime metadata.

Example:

```ts
type Holder<T extends (value: i32) => i32> = { value: T };

function take(value: Holder<(input: i32) => i32>): i32 {
  return 0;
}
```

---

# Phase 239: Generic Type Alias Nested Exact Constraint Matching

Status: Complete.

Phase 239 makes exact generic type alias constraint matching recursive for supported exact
constraint forms.

Rules:

- Exact constraints compare nested pointer-like, fixed-array, tuple, and function types structurally
  instead of relying only on rendered type names.
- Function type constraints continue to ignore parameter names, but nested parameter and return
  types must match exactly.
- Matching remains static and compile-time only.
- This phase does not add subtyping, variance, lifetime inference, callable closure values, alias
  flattening, structural conversion, or runtime metadata.

Example:

```ts
type Holder<T extends (value: i32*) => i32*> = { value: T };

function take(value: Holder<(input: i32*) => i32*>): i32 {
  return 0;
}
```

---

# Phase 240: Generic Type Alias Exact Enum Constraints

Status: Complete.

Phase 240 adds exact enum constraints for generic type aliases and emits enum typedefs before record
alias instantiations that reference them.

Rules:

- A generic type alias parameter may constrain a type argument to an exact enum type:

  ```ts
  enum Key: i32 { A = 1 }
  type Holder<T extends Key> = { value: T };
  ```

- The type argument must name the same enum exactly.
- Enum-backed generic alias instantiations emit after the enum typedef so generated C remains valid.
- Matching is static and compile-time only.
- This phase does not add enum subtyping, enum unions, implicit numeric conversion, structural
  conversion, alias flattening, or runtime metadata.

Example:

```ts
enum Key: i32 { A = 1 }
type Holder<T extends Key> = { value: T };

function take(value: Holder<Key>): i32 {
  return 0;
}
```

---

# Phase 241: Generic Type Alias Exact Struct Constraints

Status: Complete.

Phase 241 adds exact struct constraints for generic type aliases and emits generated generic alias
instantiations after static record dependencies.

Rules:

- A generic type alias parameter may constrain a type argument to an exact struct type:

  ```ts
  struct Point { x: i32 }
  type Holder<T extends Point> = { value: T };
  ```

- The type argument must name the same struct exactly.
- Generated generic alias instantiations emit after lowered struct and class record aliases so C
  fields can reference those concrete record typedefs.
- Matching is nominal, static, and compile-time only.
- This phase does not add structural struct matching, subtyping, inheritance, implicit conversion,
  alias flattening, or runtime metadata.

Example:

```ts
struct Point { x: i32 }
type Holder<T extends Point> = { value: T };

function take(value: Holder<Point>): i32 {
  return 0;
}
```

---

# Phase 242: Generic Type Alias Exact Class Constraint Emission

Status: Complete.

Phase 242 validates exact class constraints for generic type aliases through C emission and keeps
generated generic alias instantiations after class record aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact class type:

  ```ts
  class Point {
    x: i32;
    constructor(x: i32) {
      this.x = x;
    }
  }
  type Holder<T extends Point> = { value: T };
  ```

- The type argument must name the same class exactly.
- Generated generic alias instantiations that contain class fields emit after the lowered class
  record typedef.
- Matching is nominal, static, and compile-time only.
- This phase does not add class subtyping, inheritance-based assignability, structural class
  matching, virtual dispatch, heap allocation, implicit conversion, alias flattening, or runtime
  metadata.

Example:

```ts
class Point {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}
type Holder<T extends Point> = { value: T };

function take(value: Holder<Point>): i32 {
  return value.value.x;
}
```

---

# Phase 243: Generic Type Alias Exact Generic-Class Constraints

Status: Complete.

Phase 243 supports exact instantiated generic class constraints for generic type aliases.

Rules:

- A generic type alias parameter may constrain a type argument to an exact generic class
  instantiation:

  ```ts
  class Box<T> {
    value: T;
    constructor(value: T) {
      this.value = value;
    }
  }
  type Holder<T extends Box<i32>> = { value: T };
  ```

- Generic class references inside type alias constraints are monomorphized before generic alias
  constraint checking.
- The type argument must name the same instantiated generic class exactly.
- Generated generic alias instantiations emit after generated generic class record typedefs.
- Matching is nominal, static, and compile-time only.
- This phase does not add variance, class subtyping, structural class matching, inheritance-based
  assignability, implicit conversion, alias flattening, virtual dispatch, heap allocation, or
  runtime metadata.

Example:

```ts
class Box<T> {
  value: T;
  constructor(value: T) {
    this.value = value;
  }
}
type Holder<T extends Box<i32>> = { value: T };

function take(value: Holder<Box<i32>>): i32 {
  return value.value.value;
}
```

---

# Phase 244: Generic Type Alias Exact Tagged-Union Constraints

Status: Complete.

Phase 244 supports exact tagged-union constraints for generic type aliases and emits generated
generic alias instantiations after tagged-union typedefs.

Rules:

- A generic type alias parameter may constrain a type argument to an exact tagged-union type:

  ```ts
  union Result { Ok: i32; Err: i32; }
  type Holder<T extends Result> = { value: T };
  ```

- The type argument must name the same tagged union exactly.
- Generated generic alias instantiations that contain tagged-union fields emit after the tagged
  union typedef so generated C remains valid.
- Matching is nominal, static, and compile-time only.
- This phase does not add structural union matching, union subtyping, discriminant narrowing
  changes, implicit conversion, alias flattening, or runtime metadata.

Example:

```ts
union Result { Ok: i32; Err: i32; }
type Holder<T extends Result> = { value: T };

function take(value: Holder<Result>): i32 {
  return 0;
}
```

---

# Phase 245: Generated Generic Alias Dependency Ordering

Status: Complete.

Phase 245 emits generated generic type alias instantiations after helper typedefs they may depend
on, including tuple and slice typedefs.

Rules:

- Generated generic type alias instantiations remain before function prototypes.
- Tuple typedefs used by generated generic alias fields emit before the generated alias.
- Slice typedefs used by generated generic alias fields emit before the generated alias.
- Existing enum, record, class, and tagged-union dependency ordering remains valid.
- This phase does not add alias flattening, recursive alias support, new inference rules, runtime
  metadata, or JavaScript runtime behavior.

Example:

```ts
type Holder<T> = { value: T };

function take(value: Holder<[i32, u32]>): i32 {
  return 0;
}
```

Generated C emits `Tuple_i32_u32` before `Holder_i32_u32`.

---

# Phase 246: Generated Generic Alias Record Dependency Ordering

Status: Complete.

Phase 246 emits anonymous record helper typedefs before generated generic type alias instantiations
that reference them.

Rules:

- Generated generic type alias instantiations may contain anonymous record type arguments.
- Anonymous record typedefs used by generated generic alias fields emit before the generated alias.
- Generated generic aliases remain before function prototypes.
- Existing enum, struct, class, tagged-union, optional, slice, and tuple dependency ordering remains
  valid.
- This phase does not add structural interface conversion, alias flattening, recursive aliases,
  inferred alias type arguments, runtime metadata, or JavaScript object semantics.

Example:

```ts
type Holder<T> = { value: T };

function take(value: Holder<{ x: i32 }>): i32 {
  return value.value.x;
}
```

Generated C emits the anonymous record typedef before `Holder_x_i32`.

---

# Phase 247: Generated Generic Alias Optional Dependency Ordering

Status: Complete.

Phase 247 emits optional helper typedefs before generated generic type alias instantiations that
reference optional types not covered by pre-alias builtin optional emission.

Rules:

- Generated generic type alias instantiations may contain optional type arguments.
- Optional helper typedefs used by generated generic alias fields emit before the generated alias.
- Optional helpers may depend on anonymous record helper typedefs already emitted earlier.
- Generated generic aliases remain before constants and function prototypes.
- Existing enum, struct, class, tagged-union, record, slice, and tuple dependency ordering remains
  valid.
- This phase does not add inferred alias type arguments, recursive aliases, runtime metadata,
  implicit `undefined`, implicit `null`, or JavaScript object semantics.

Example:

```ts
type Holder<T> = { value: T };

function take(value: Holder<{ x: i32 }?>): i32 {
  return 0;
}
```

Generated C emits the anonymous record typedef, then its optional typedef, then `Holder_x_i32`.

---

# Phase 248: Post-Helper Optional Dependency Ordering

Status: Complete.

Phase 248 emits optional helper typedefs that depend on slice or tuple helper typedefs after those
helpers and before generated generic type alias instantiations.

Rules:

- Optional helpers whose element type depends on slice or tuple helpers emit after slice and tuple
  helper typedefs.
- Optional helpers that do not depend on post-alias helpers continue to emit in the earlier optional
  section.
- Generated generic aliases that contain optional tuple or optional slice fields emit after the
  required optional helper typedef.
- Existing record, tagged-union, optional, slice, tuple, and generated generic alias ordering
  remains valid.
- This phase does not add inferred alias type arguments, recursive aliases, implicit nullability,
  runtime metadata, or JavaScript object semantics.

Example:

```ts
type Holder<T> = { value: T };

function take(value: Holder<[i32, u32]?>): i32 {
  return 0;
}
```

Generated C emits `Tuple_i32_u32`, then `Optional__i32__u32_`, then `Holder_i32_u32`.

---

# Phase 249: Generated Alias Optional Dependency Splitting

Status: Complete.

Phase 249 splits generated generic type alias emission around optional helpers that depend on
another generated generic alias.

Rules:

- Generated aliases that do not require post-generated optional helpers emit first.
- Optional helpers whose element type references a generated alias emit after that generated alias.
- Generated aliases containing those optional fields emit after the optional helper.
- Existing record, optional, slice, tuple, and post-helper optional ordering remains valid.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit nullability, or JavaScript object semantics.

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<Box<i32>?>): i32 {
  return 0;
}
```

Generated C emits `Box_i32`, then `Optional_Box_i32`, then `Holder_Box_i32`.

---

# Phase 250: Generated Optional Tuple Dependency Ordering

Status: Complete.

Phase 250 emits tuple helper typedefs containing optionals of generated generic aliases only after
those generated aliases and optional helpers are available.

Rules:

- Tuple helpers that do not contain generated-alias optionals emit in the existing tuple helper
  section.
- Generated aliases required by optional tuple elements emit before those optional helpers.
- Optional helpers whose element is a generated alias emit before tuple helpers that contain them.
- Generated aliases containing those tuple helpers emit after the tuple helper.
- Existing non-generated tuple, optional, slice, and generated alias dependency ordering remains
  valid.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit nullability, or JavaScript object semantics.

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<[Box<i32>?, i32]>): i32 {
  return 0;
}
```

Generated C emits `Box_i32`, then `Optional_Box_i32`, then `Tuple_Box_x5f_i32_x3f__i32`, then
`Holder_Box_i32_i32`.

---

# Phase 251: Generated Optional Slice Dependency Ordering

Status: Complete.

Phase 251 emits slice helper typedefs containing optionals of generated generic aliases only after
those generated aliases and optional helpers are available.

Rules:

- Slice helpers that do not contain generated-alias optionals emit in the existing slice helper
  section.
- Generated aliases required by optional slice elements emit before those optional helpers.
- Optional helpers whose element is a generated alias emit before slice helpers that contain them.
- Generated aliases containing those slice helpers emit after the slice helper.
- Existing non-generated slice, tuple, optional, and generated alias dependency ordering remains
  valid.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit nullability, or JavaScript object semantics.

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<Slice<Box<i32>?>>): i32 {
  return 0;
}
```

Generated C emits `Box_i32`, then `Optional_Box_i32`, then `Slice_Box_i32_`, then
`Holder_Slice_Box_i32`.

---

# Phase 252: Generated Optional Record Dependency Ordering

Status: Complete.

Phase 252 emits anonymous record helper typedefs containing optionals of generated generic aliases
after those generated aliases and optional helpers are available.

Rules:

- Record helpers that do not contain generated-alias optionals emit in the existing record helper
  section.
- Generated aliases required by optional record fields emit before those optional helpers.
- Optional helpers whose element is a generated alias emit before record helpers that contain them.
- Generated aliases containing those record helpers emit after the record helper.
- Existing non-generated record, slice, tuple, optional, and generated alias dependency ordering
  remains valid.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit nullability, or JavaScript object semantics.

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<{ x: Box<i32>? }>): i32 {
  return 0;
}
```

Generated C emits `Box_i32`, then `Optional_Box_i32`, then the anonymous record typedef, then
`Holder_x_Box_i32`.

---

# Phase 253: Post-Generated Helper Optional Ordering

Status: Complete.

Phase 253 emits optional helpers whose element depends on post-generated record, slice, or tuple
helpers only after those helpers are available.

Rules:

- Direct optionals of generated aliases still emit after the generated alias they wrap.
- Record, slice, and tuple helpers that contain those direct optionals emit after the direct
  optional.
- Optionals wrapping those helpers emit after the helper typedef.
- Generated aliases containing those wrapping optionals emit after the wrapping optional helper.
- Existing generated alias, optional, record, slice, and tuple dependency ordering remains valid.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit nullability, or JavaScript object semantics.

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<{ x: Box<i32>? }?>): i32 {
  return 0;
}
```

Generated C emits `Box_i32`, then `Optional_Box_i32`, then the anonymous record typedef, then the
optional record typedef, then `Holder_x_Box_i32`.

---

# Phase 254: Direct Generated Helper Optional Ordering

Status: Complete.

Phase 254 emits record, slice, and tuple helpers that directly contain generated generic aliases
after those aliases and before optionals or generated aliases that depend on those helpers.

Rules:

- Helpers with no generated alias dependency still emit in the normal helper section.
- Generated aliases that are independent of generated-alias optionals emit before helpers that
  directly reference them.
- Record, slice, and tuple helpers that directly contain generated aliases emit after those aliases.
- Optionals wrapping those helpers emit after the helper typedef.
- Generated aliases containing those optionals emit after the optional helper.
- Helpers that depend on generated-alias optionals keep the Phase 250 through Phase 253 ordering.
- This phase does not add recursive aliases, inferred alias type arguments, runtime metadata,
  implicit allocation, or JavaScript object semantics.

Examples:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function a(value: Holder<{ x: Box<i32> }?>): i32 { return 0; }
function b(value: Holder<[Box<i32>]?>): i32 { return 0; }
function c(value: Holder<Slice<Box<i32>>?>): i32 { return 0; }
```

Generated C emits `Box_i32` before the anonymous record, tuple, or slice helper, then emits the
optional helper, then the dependent `Holder_*` alias.

---

# Phase 255: Optional Fixed-Array Diagnostic

Status: Complete.

Phase 255 rejects optional array payload types during type checking instead of allowing C emission
to reach an array declarator failure.

Rules:

- `T?` remains valid for scalar, record, class, enum, tagged-union, tuple, slice, and pointer-like
  payloads already supported by the emitter.
- `Element[N]?` and inferred array optional payloads are rejected with a type diagnostic.
- Generic aliases that instantiate to optional fixed arrays are rejected before C emission.
- Use `Slice<T>?` or a named record wrapper when optional array-like data is needed.
- This phase does not change fixed-array value semantics, introduce hidden array boxing, return
  arrays by value in C, or add JavaScript array/runtime behavior.

Diagnostic:

- `Optional type cannot contain array type`

Example:

```ts
type Box<T> = { item: T };
type Holder<T> = { value: T };

function take(value: Holder<Box<i32>[2]?>): i32 {
  return 0;
}
```

The program is rejected during checking instead of crashing during optional helper emission.

---

# Phase 256: Optional Function-Type Diagnostic

Status: Complete.

Phase 256 rejects optional function-type payloads during type checking instead of allowing C
emission to reach a function-pointer declarator failure.

Rules:

- `((value: i32) => i32)?` and `Optional<(value: i32) => i32>` are rejected.
- Generic aliases that instantiate to optional function types are rejected before C emission.
- Function types remain valid where the existing declarator-aware C emitter supports them, such as
  record fields and parameters.
- Use an explicit named callback wrapper record when optional callback storage is needed.
- This phase does not add function-pointer typedef synthesis, hidden closure allocation, captures,
  dynamic dispatch, or JavaScript function-object semantics.

Diagnostic:

- `Optional type cannot contain function type`

Example:

```ts
type Holder<T> = { value: T };

function take(value: Holder<((value: i32) => i32)?>): i32 {
  return 0;
}
```

The program is rejected during checking instead of crashing during optional helper emission.

---

# Phase 257: Literal Value-Type Diagnostic

Status: Complete.

Phase 257 rejects literal-only types in runtime value positions before C emission.

Rules:

- Literal-only type aliases remain valid as compile-time type aliases and are not emitted as C
  typedefs.
- Direct literal types such as `1`, `true`, or `'ok'` cannot be used as parameter, local, constant,
  field, tuple element, optional payload, or function return value types.
- Literal-only union types cannot be used directly as runtime value types.
- Literal-only type aliases cannot be used as runtime value types until a future phase specifies
  representation and lowering.
- This phase does not add literal value refinements, enum-like literal union lowering, tagged-union
  synthesis, runtime metadata, or JavaScript literal semantics.

Diagnostics:

- `Literal type cannot be used as a value type`
- `Literal-only type alias 'Name' cannot be used as a value type`

Examples:

```ts
type One = 1;

function a(value: 1): i32 {
  return 0;
}
function b(value: One): i32 {
  return 0;
}
```

Both functions are rejected during checking instead of emitting unresolved or unsupported C types.

---

# Phase 258: Runtime Alias Literal Field Diagnostic

Status: Complete.

Phase 258 rejects literal-only types inside runtime-emitted type aliases before C emission.

Rules:

- Top-level literal-only aliases remain compile-time-only aliases and are not emitted.
- Runtime aliases such as records, tuples, function types, optionals, slices, arrays, conditionals,
  mapped aliases, and nested helper shapes cannot contain direct literal value types.
- Runtime aliases cannot contain fields or elements whose named type resolves to a literal-only
  alias.
- Diagnostics are reported during declaration checking before the C emitter attempts to lower a
  literal type.
- This phase does not add literal field representation, enum-like literal union lowering,
  value-level refinement, runtime metadata, or JavaScript literal semantics.

Diagnostics:

- `Literal type cannot be used as a value type`
- `Literal-only type alias 'Name' cannot be used as a value type`

Examples:

```ts
type One = 1;
type A = { x: 1 };
type B = { x: One };
```

`One` is still accepted as a compile-time-only alias. `A` and `B` are rejected because their record
layout would require a runtime representation for a literal-only type.

---

# Phase 259: Generic Alias Exact Literal Constraints

Status: Complete.

Phase 259 supports exact single-literal constraints on generic type aliases.

Rules:

- A generic type alias parameter may use a single literal constraint such as `T extends 1`,
  `T extends true`, or `T extends "ok"`.
- The supplied type argument must be the exact same literal type.
- Unsatisfied literal constraints use the existing generic constraint diagnostic path.
- Literal-constrained parameters may be used only where the instantiated alias remains otherwise
  valid under literal value-type diagnostics.
- This phase does not add literal-union constraint satisfaction, literal runtime representation,
  value refinements, narrowing, enum synthesis, or JavaScript literal semantics.

Examples:

```ts
type Holder<T extends 1> = { value: i32 };

function take(value: Holder<1>): i32 {
  return value.value;
}
```

`Holder<2>` is rejected with:

```text
Generic type alias 'Holder' type parameter 'T' with type '2' does not satisfy 1
```

---

# Phase 260: Generic Function Exact Literal Constraints

Status: Complete.

Phase 260 supports exact single-literal constraints on generic function parameters.

Rules:

- A generic function parameter may use a single literal constraint such as `T extends 1`,
  `T extends true`, or `T extends "ok"`.
- The supplied type argument must be the exact same literal type.
- Unsatisfied literal constraints use the existing generic function constraint diagnostic path.
- Literal-constrained parameters may be used only where the instantiated function remains otherwise
  valid under literal value-type diagnostics.
- This phase does not add literal-union constraint satisfaction, literal runtime representation,
  value refinements, narrowing, enum synthesis, or JavaScript literal semantics.

Example:

```ts
function keep<T extends 1>(value: i32): i32 {
  return value;
}

function main(): i32 {
  return keep<1>(7);
}
```

`keep<2>(7)` is rejected with:

```text
Generic function 'keep' type parameter 'T' with type '2' does not satisfy 1
```

---

# Phase 261: Generic Class Exact Literal Constraints

Status: Complete.

Phase 261 supports exact single-literal constraints on generic class parameters.

Rules:

- A generic class parameter may use a single literal constraint such as `T extends 1`,
  `T extends true`, or `T extends "ok"`.
- The supplied type argument must be the exact same literal type.
- Unsatisfied literal constraints use the existing generic class constraint diagnostic path.
- Literal-constrained parameters may be used only where the instantiated class remains otherwise
  valid under literal value-type diagnostics.
- This phase does not add literal-union constraint satisfaction, literal runtime representation,
  value refinements, narrowing, enum synthesis, or JavaScript literal semantics.

Example:

```ts
class Holder<T extends 1> {
  value: i32;
}

function main(): i32 {
  const holder: Holder<1> = { value: 7 };
  return holder.value;
}
```

`Holder<2>` is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type '2' does not satisfy 1
```

---

# Phase 262: Generic Function Record Shape Constraints

Status: Complete.

Phase 262 supports static record-shape constraints on generic function parameters.

Rules:

- A generic function parameter may use an inline record constraint such as `T extends { id: i32; }`.
- A type argument satisfies the constraint when it is an inline record type or a record type alias
  containing every required constraint field with exactly matching field types.
- Optional fields in the constraint may be absent from the supplied record type.
- Missing and mismatched fields produce field-specific generic constraint diagnostics.
- This phase does not add class-shape constraints, generic class record constraints, generic alias
  record constraints beyond existing support, structural method constraints, width-subtyping for
  non-record forms, or JavaScript object-map semantics.

Example:

```ts
type Item = { id: i32 };

function read<T extends { id: i32 }>(value: T): i32 {
  return value.id;
}

function main(): i32 {
  const item: Item = { id: 7 };
  return read<Item>(item);
}
```

A missing field is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'Named' is missing required field 'id' for record constraint
```

A mismatched field is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'Item' has field 'id' of type 'u32' but record constraint requires 'i32'
```

---

# Phase 263: Generic Class Record Shape Constraints

Status: Complete.

Phase 263 supports static record-shape constraints on generic class parameters.

Rules:

- A generic class parameter may use an inline record constraint such as `T extends { id: i32; }`.
- A type argument satisfies the constraint when it is an inline record type, a record type alias, a
  concrete class with matching instance fields, or a struct with matching fields.
- Every required constraint field must exist with an exactly matching field type.
- Optional fields in the constraint may be absent from the supplied record-like type.
- Missing and mismatched fields produce field-specific generic class constraint diagnostics.
- This phase does not add generic alias record constraints beyond existing support, structural
  method constraints, value refinements, width-subtyping for non-record forms, or JavaScript
  object-map semantics.

Example:

```ts
type Item = { id: i32 };

class Holder<T extends { id: i32 }> {
  value: T;
}

function main(): i32 {
  const item: Item = { id: 7 };
  const holder: Holder<Item> = { value: item };
  return holder.value.id;
}
```

A missing field is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'Named' is missing required field 'id' for record constraint
```

A mismatched field is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'Item' has field 'id' of type 'u32' but record constraint requires 'i32'
```

---

# Phase 264: Generic Alias Struct Record Shape Constraints

Status: Complete.

Phase 264 extends generic type-alias record-shape constraints to struct type arguments.

Rules:

- A generic type alias parameter may use an inline record constraint such as
  `T extends { x: i32; }`.
- A struct type argument satisfies the constraint when every required constraint field exists on the
  struct with an exactly matching field type.
- Optional fields in the constraint may be absent from the struct.
- Missing and mismatched struct fields use the existing generic type-alias record constraint
  diagnostic path.
- This phase does not add structural method constraints, runtime reflection, non-record structural
  subtyping, value refinements, or JavaScript object-map semantics.

Example:

```ts
struct Point {
  x: i32;
}

type Holder<T extends { x: i32 }> = { value: T };

function main(): i32 {
  const point: Point = { x: 7 };
  const holder: Holder<Point> = { value: point };
  return holder.value.x;
}
```

A mismatched struct field is rejected with:

```text
Generic type alias 'Holder' type parameter 'T' with type 'Point' has field 'x' of type 'u32' but record constraint requires 'i32'
```

---

# Phase 265: Generic Function Record Field Modifier Constraints

Status: Complete.

Phase 265 tightens generic function record-shape constraints for field modifiers.

Rules:

- A required field in a generic function record constraint is not satisfied by an optional field in
  the supplied record type.
- A mutable field in a generic function record constraint is not satisfied by a readonly field in
  the supplied record type.
- Optional and readonly mismatches produce modifier-specific diagnostics before general type
  mismatch diagnostics.
- This phase does not add runtime property metadata, structural method constraints, mutation
  analysis, or JavaScript object semantics.

Examples:

```ts
type MaybeItem = { id?: i32 };
type ReadonlyItem = { readonly id: i32 };

function read<T extends { id: i32 }>(value: T): i32 {
  return 0;
}
```

`read<MaybeItem>(value)` is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'MaybeItem' has optional field 'id' but record constraint requires it
```

`read<ReadonlyItem>(value)` is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'ReadonlyItem' has readonly field 'id' but record constraint requires a mutable field
```

---

# Phase 266: Generic Class Record Field Modifier Constraints

Status: Complete.

Phase 266 tightens generic class record-shape constraints for field modifiers.

Rules:

- A required field in a generic class record constraint is not satisfied by an optional field in the
  supplied record-like type.
- A mutable field in a generic class record constraint is not satisfied by a readonly field in the
  supplied record-like type.
- Optional and readonly mismatches produce modifier-specific diagnostics before general type
  mismatch diagnostics.
- This phase does not add runtime property metadata, structural method constraints, mutation
  analysis, or JavaScript object semantics.

Examples:

```ts
type MaybeItem = { id?: i32 };
type ReadonlyItem = { readonly id: i32 };

class Holder<T extends { id: i32 }> {
  value: T;
}
```

`Holder<MaybeItem>` is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'MaybeItem' has optional field 'id' but record constraint requires it
```

`Holder<ReadonlyItem>` is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'ReadonlyItem' has readonly field 'id' but record constraint requires a mutable field
```

---

# Phase 267: Generic Function Nested Record Shape Constraints

Status: Complete.

Phase 267 extends generic function record-shape constraints to nested record fields.

Rules:

- A nested inline record constraint must be satisfied structurally by the supplied nested
  record-like field.
- Named record aliases may satisfy nested inline record constraints.
- Nested diagnostics report dotted field paths.
- Optional and readonly modifier checks apply before nested type mismatch checks.
- This phase does not add runtime reflection, dynamic property lookup, recursive constraint solving,
  or JavaScript object semantics.

Examples:

```ts
type Meta = { id: i32; tag: i32 };
type Item = { meta: Meta };

function read<T extends { meta: { id: i32 } }>(value: T): i32 {
  return value.meta.id;
}
```

`read<Item>(item)` is valid.

A missing nested field is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint
```

A nested type mismatch is rejected with:

```text
Generic function 'read' type parameter 'T' with type 'Item' has field 'meta.id' of type 'u32' but record constraint requires 'i32'
```

---

# Phase 268: Generic Class Nested Record Shape Constraints

Status: Complete.

Phase 268 extends generic class record-shape constraints to nested record fields.

Rules:

- A nested inline record constraint must be satisfied structurally by the supplied nested
  record-like field.
- Named record aliases, class records, and structs may satisfy nested inline record constraints.
- Nested diagnostics report dotted field paths.
- Optional and readonly modifier checks apply before nested type mismatch checks.
- This phase does not add runtime reflection, dynamic property lookup, recursive constraint solving,
  inheritance-based structural fields, or JavaScript object semantics.

Examples:

```ts
type Meta = { id: i32; tag: i32 };
type Item = { meta: Meta };

class Holder<T extends { meta: { id: i32 } }> {
  value: T;
}
```

`Holder<Item>` is valid.

A missing nested field is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint
```

A nested type mismatch is rejected with:

```text
Generic class 'Holder' type parameter 'T' with type 'Item' has field 'meta.id' of type 'u32' but record constraint requires 'i32'
```

---

# Phase 269: Generic Function Record Shape Multi-Diagnostics

Status: Complete.

Phase 269 restores and extends multi-diagnostic reporting for generic function record-shape
constraints.

Rules:

- A generic function record constraint reports every unsatisfied sibling field in declaration order.
- Nested inline record constraints report every unsatisfied nested sibling field in declaration
  order.
- Dotted field paths are preserved for nested diagnostics.
- This phase does not add runtime reflection, dynamic property lookup, union-aware shape solving, or
  JavaScript object semantics.

Example:

```ts
type Item = { name: i32 };

function read<T extends { id: i32; count: i32 }>(value: T): i32 {
  return 0;
}
```

`read<Item>(item)` reports both missing fields:

```text
Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'id' for record constraint
Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'count' for record constraint
```

Nested constraints report dotted paths:

```text
Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint
Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.count' for record constraint
```

---

# Phase 270: Generic Class Record Shape Multi-Diagnostics

Status: Complete.

Phase 270 restores and extends multi-diagnostic reporting for generic class record-shape
constraints.

Rules:

- A generic class record constraint reports every unsatisfied sibling field in declaration order.
- Nested inline record constraints report every unsatisfied nested sibling field in declaration
  order.
- Dotted field paths are preserved for nested diagnostics.
- This phase does not add runtime reflection, dynamic property lookup, union-aware shape solving,
  inheritance-based structural fields, or JavaScript object semantics.

Example:

```ts
type Item = { name: i32 };

class Holder<T extends { id: i32; count: i32 }> {
  value: T;
}
```

`Holder<Item>` reports both missing fields:

```text
Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'id' for record constraint
Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'count' for record constraint
```

Nested constraints report dotted paths:

```text
Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint
Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.count' for record constraint
```

---

# Phase 271: Generic Alias Record Shape Multi-Diagnostics

Status: Complete.

Phase 271 restores and extends multi-diagnostic reporting for generic type-alias record-shape
constraints.

Rules:

- A generic type-alias record constraint reports every unsatisfied sibling field in declaration
  order.
- Nested inline record constraints report every unsatisfied nested sibling field in declaration
  order.
- Dotted field paths are preserved for nested diagnostics.
- This phase does not add runtime reflection, dynamic property lookup, union-aware shape solving, or
  JavaScript object semantics.

Example:

```ts
type Point = { name: i32 };
type Holder<T extends { id: i32; count: i32 }> = { value: T };
```

`Holder<Point>` reports both missing fields:

```text
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'id' for record constraint
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'count' for record constraint
```

Nested constraints report dotted paths:

```text
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.id' for record constraint
Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.count' for record constraint
```

---

# Phase 272: Generic Function Exact Primitive Constraints

Status: Complete.

Phase 272 allows generic function type parameters to use primitive TypeC names as exact static
constraints.

Rules:

- `T extends i32` on a generic function requires the supplied type argument to be exactly `i32`.
- Primitive constraints use TypeC primitive names directly and preserve one-to-one emitted C names.
- Unsatisfied primitive constraints use the same static diagnostic form as exact literal
  constraints.
- Interface constraints remain structural-by-method; primitive constraints are exact-by-name.
- This phase does not add primitive subtyping, numeric widening, runtime generics, overload ranking,
  or JavaScript coercion semantics.

Example:

```ts
function keep<T extends i32>(value: T): T {
  return value;
}

function main(): i32 {
  return keep<i32>(7);
}
```

`keep<u32>(7)` is rejected with:

```text
Generic function 'keep' type parameter 'T' with type 'u32' does not satisfy i32
```

---

# TypeC 0.1 Completion Checklist

This section replaces open-ended future work with a concrete TypeC 0.1 completion plan. TypeC 0.1 is
not a compatibility milestone for another language. It is the first self-contained TypeC language
release: a small, documented, statically checked, C-emitting systems language with no known silent
miscompilations inside its supported subset.

## TypeC 0.1 Release Contract

TypeC 0.1 is complete only when every checklist phase below is complete and validated.

Required release properties:

- Every accepted `.tc` program in the 0.1 subset has specified static semantics.
- Every accepted `.tc` program in the 0.1 subset emits portable C or a deliberate C-ABI diagnostic.
- Every rejected `.tc` program fails before C emission with a specific diagnostic code and source
  span.
- Unsupported syntax and unsupported type/lowering combinations are rejected explicitly.
- No compiler pass may rely on emitter failure as validation.
- No parser hooks, TODO branches, compatibility shims, or dead code may be added for post-0.1
  features.
- Documentation, examples, diagnostics, lowering behavior, and tests must land in the same phase as
  any language change.
- The full test suite, formatter, compiler build, and `./bin/STC` rebuild must pass after each
  phase.

Validation command set for every phase:

```bash
deno fmt
deno test -A
deno task build
./bin/STC --version
```

A phase is not complete until all relevant positive examples, negative diagnostics, and C-emission
or no-emission assertions are present.

## 0.1 Scope Boundaries

The following are out of scope for 0.1 and must be rejected clearly when encountered:

- garbage collection
- exceptions
- async execution
- coroutines
- runtime reflection
- dynamic property maps
- runtime generic values
- owned interface values
- virtual class dispatch
- operator overloading
- user-defined implicit conversions
- variadic TypeC functions other than checked C extern declarations
- closures that capture local state
- package registry behavior
- incremental compilation cache format
- non-C backends

These exclusions are not blockers for 0.1. They are deliberate boundaries.

## 0.1 Definition of Done

TypeC 0.1 is releasable when all items below are true:

- `docs/language.md` specifies all 0.1 syntax and semantics.
- `docs/c-emission.md` specifies emitted C layout, naming, includes, helper ordering, and ABI rules.
- `docs/diagnostics.md` lists every diagnostic code used by the compiler.
- `docs/stdlib.md` documents every standard-library module shipped with 0.1.
- `examples/0.1/` contains buildable examples for the complete supported subset.
- The compiler rejects every explicitly out-of-scope feature with diagnostics, not parser crashes or
  emitter crashes.
- Native compile smoke tests cover at least: Linux clang, Linux gcc, and C11 mode.
- Test coverage includes parser, checker, lowerer, emitter, driver, LSP diagnostic, and native C
  compile paths for representative programs.

---

# Phase 273: 0.1 Language Specification Freeze

Status: Complete.

Goal: Convert the current implemented subset into a normative 0.1 language specification.

Deliverables:

- Rewrite `docs/language.md` as the 0.1 language reference.
- Add a top-level "0.1 supported subset" section.
- Add a top-level "0.1 rejected constructs" section.
- Add grammar summaries for declarations, statements, expressions, and type references.
- Add precise terminology for value type, type reference, runtime layout type, static-only type,
  lvalue, rvalue, compile-time constant, and C ABI type.
- Add examples for every supported declaration and statement kind.
- Add negative examples for every rejected statement/expression category.

Acceptance criteria:

- Every currently implemented source construct is either documented as 0.1-supported or explicitly
  rejected as outside 0.1.
- No section may use vague wording such as "partial", "maybe", "future", or "TBD" for 0.1 behavior.
- Each supported feature links to at least one compiler test or example.

---

# Phase 274: Diagnostic Code Inventory and Stability

Status: Complete.

Goal: Make diagnostics stable enough for users, tests, and LSP clients.

Deliverables:

- Add `docs/diagnostics.md`.
- List every diagnostic code from `src/core/diagnostic_codes.ts`.
- Document message shape, severity, source span rule, and primary recovery action for each code.
- Add a test that every emitted diagnostic code is documented.
- Add a test that every documented diagnostic code exists in `diagnostic_codes.ts`.
- Remove duplicate codes or unused codes.

Acceptance criteria:

- Unknown diagnostic codes cannot be emitted.
- Undocumented diagnostic codes fail tests.
- Diagnostics for unsupported 0.1 constructs have dedicated codes instead of generic internal
  errors.

---

# Phase 275: Parser Recovery and Unsupported Syntax Diagnostics

Status: Complete.

Goal: Ensure invalid syntax produces bounded, useful diagnostics without blocking later files or
statements unnecessarily.

Deliverables:

- Define parser recovery synchronization points for declarations, statements, parameter lists,
  argument lists, type argument lists, record fields, tuple elements, and import clauses.
- Add diagnostics for unsupported 0.1 syntax forms instead of ambiguous parse failures.
- Add tests for malformed declarations, malformed statements, malformed type references, and
  malformed expressions.

Acceptance criteria:

- Parser diagnostics include exact source spans.
- Parser recovery never fabricates semantic nodes that can reach lowering or emission.
- A malformed construct cannot cause an emitter crash.

---

# Phase 276: Value Model and Initialization Rules

Status: Complete.

Goal: Specify and enforce how values are created, initialized, copied, and stored.

Rules for 0.1:

- Local `const` requires an initializer.
- Local `let` requires either an initializer or a complete explicit type with zero-initialization
  syntax if zero-initialization is supported for that type.
- Uninitialized reads are rejected.
- Function parameters are initialized values.
- Record, tuple, array, class, enum, tagged-union, optional, pointer, reference, slice, and
  primitive values have explicit initialization rules.
- Implicit deep allocation is not performed.
- Copy behavior is bitwise value copy for 0.1 layout types unless a type is explicitly marked
  non-copyable by an existing checked rule.

Deliverables:

- Document initialization and copy rules in `docs/language.md`.
- Add definite-assignment analysis for local variables and branches if missing.
- Add tests for initialized locals, uninitialized reads, branch initialization, loop initialization,
  and aggregate initialization.

Acceptance criteria:

- Every local read is proven initialized.
- Every aggregate value is fully initialized or rejected.
- No generated C reads an uninitialized local for valid TypeC input.

---

# Phase 277: Assignment, Mutability, and Lvalue Rules

Status: Complete.

Goal: Finalize all assignment target semantics for 0.1.

Rules for 0.1:

- Assignment is a statement, not an expression.
- Valid assignment targets are mutable locals, mutable fields, mutable array elements, mutable tuple
  elements when supported, dereferenced mutable pointers, and explicitly mutable reference targets.
- `const` locals are not assignable.
- `readonly` fields are not assignable after initialization.
- Optional, borrowed-interface, and temporary expression results are not assignable unless
  explicitly unwrapped into a mutable lvalue by supported syntax.
- Compound assignment and increment/decrement require the same lvalue validity as simple assignment.

Deliverables:

- Document lvalue categories.
- Audit checker assignment target logic against the rule list.
- Add tests for every valid and invalid lvalue category.

Acceptance criteria:

- No invalid assignment target reaches C emission.
- Readonly and const violations use specific diagnostics.
- Compound assignment cannot bypass mutability checks.

---

# Phase 278: Primitive Types, Numeric Operations, and Cast Rules

Status: Complete.

Goal: Freeze primitive operation and conversion semantics for 0.1.

Rules for 0.1:

- Primitive types are exactly the documented TypeC fixed-width names plus `bool`, `void`, and
  documented pointer-sized aliases.
- No implicit numeric widening is performed except where already explicitly specified and tested.
- Arithmetic operands must have compatible numeric types.
- Bitwise operands must be integer types.
- Comparisons return `bool`.
- Cast syntax must state whether the cast is numeric conversion, pointer conversion, or rejected.
- Constant numeric literals must be range-checked against their target type.

Deliverables:

- Document primitive sizes, signedness, and operation tables.
- Add tests for every primitive operator family.
- Add tests for literal range boundaries.
- Add tests for rejected implicit conversions.

Acceptance criteria:

- The checker and C emitter agree on primitive width and signedness.
- Invalid numeric operations produce checker diagnostics, not C compiler diagnostics.

---

# Phase 279: Pointer, Reference, Slice, and Arena Semantics

Status: Complete.

Goal: Make TypeC's explicit memory model coherent enough for 0.1 use.

Rules for 0.1:

- Document raw pointer, safe pointer, reference, slice, and arena-owned value categories.
- Document allowed construction forms for each category.
- Document dereference rules, nullability rules, indexing rules, and lifetime limitations enforced
  by the compiler.
- Any lifetime property not enforced by the compiler must be documented as caller responsibility and
  surfaced in examples.
- Safe pointer operations must never lower to unchecked C forms unless the source syntax explicitly
  selected unchecked behavior.

Deliverables:

- Add memory model section to `docs/language.md`.
- Add `docs/c-emission.md` memory-layout section.
- Add tests for pointer/reference/slice construction, reads, writes, invalid dereferences, invalid
  conversions, arena allocation, and arena lifetime misuse that the checker can detect.

Acceptance criteria:

- Supported memory constructs emit deterministic C.
- Unsupported memory constructs are rejected before emission.
- The docs clearly separate compiler-enforced safety from documented programmer obligations.

---

# Phase 280: Arrays, Tuples, Slices, and Bounds Semantics

Status: Complete.

Goal: Complete fixed aggregate sequence behavior for 0.1.

Rules for 0.1:

- Fixed arrays have compile-time length and homogeneous element type.
- Tuples have compile-time length and per-position element types.
- Slices are non-owning views with pointer plus length representation.
- Array and tuple literal lengths must match expected type unless inference rules specify exact
  inference.
- Tuple indexing requires a compile-time constant index.
- Runtime array/slice indexing is allowed only with documented unchecked or checked behavior.
- Array fill and slice helpers must have documented lowering.

Deliverables:

- Document array, tuple, and slice semantics.
- Add tests for literal inference, explicit annotations, mutation, indexing, destructuring, function
  parameters, return values, and C emission.
- Add diagnostics for unsupported optional array/function forms if not already fully covered.

Acceptance criteria:

- All valid array/tuple/slice examples compile to C and native smoke tests pass.
- Every invalid length/index/element mismatch has a specific diagnostic.

---

# Phase 281: Records, Structs, and Static Object Shapes

Status: Complete.

Goal: Finish static record/struct semantics for 0.1.

Rules for 0.1:

- `struct` is plain data only.
- Record type aliases and structs lower to deterministic C layouts.
- Field order is declaration order.
- Optional fields, readonly fields, and nested fields have documented layout and assignment rules.
- Record literals must satisfy required fields and reject unknown fields unless spread/rest rules
  explicitly account for them.
- Record spread/rest copies fields statically in documented order.
- Dynamic property lookup is not part of 0.1.

Deliverables:

- Document record and struct layout.
- Add tests for required fields, optional fields, readonly fields, nested records, spread, rest,
  field assignment, field reads, and C emission order.
- Add native compile tests for nested record/struct programs.

Acceptance criteria:

- Record and struct C layout is stable and documented.
- Invalid record literals and field accesses fail before C emission.

---

# Phase 282: Classes as Static Layouts

Status: Complete.

Goal: Freeze the non-virtual class model for 0.1.

Rules for 0.1:

- Classes are value types with static layout.
- Constructors return initialized class values.
- Methods lower to functions with explicit receiver representation.
- Method dispatch is static.
- Single inheritance flattens fields and copies/replaces methods according to documented rules.
- `super`, virtual dispatch, hidden allocation, and runtime class metadata are rejected for 0.1.

Deliverables:

- Document class layout, constructor lowering, receiver lowering, method naming, inheritance
  flattening, and override behavior.
- Add tests for field initialization, methods, static methods if supported, constructors,
  inheritance, overrides, invalid `super`, invalid virtual assumptions, and C emission.

Acceptance criteria:

- Class programs do not depend on runtime metadata.
- Every class member used at runtime has deterministic emitted C name and layout.

---

# Phase 283: Interfaces and Borrowed Interface Views

Status: Complete.

Goal: Complete the 0.1 interface story without owned trait objects.

Rules for 0.1:

- Interfaces declare method signatures only.
- Classes satisfy interfaces through explicit `implements`.
- Generic interface constraints use static method satisfaction.
- `Interface&` is the only runtime interface view in 0.1.
- A borrowed interface view is non-owning and represented as receiver pointer plus function
  pointers.
- Owning interface values are rejected.
- Ambiguous or missing method mappings are rejected.

Deliverables:

- Document interface declarations, `implements`, generic constraints, borrowed interface value
  construction, call lowering, lifetime responsibility, and invalid owning values.
- Add tests for valid borrowed calls, missing methods, mismatched signatures, ambiguous methods,
  invalid owning interface values, and C emission.

Acceptance criteria:

- Borrowed interface calls emit deterministic C without allocation.
- Interface diagnostics identify the exact missing or mismatched method.

---

# Phase 284: Enums, Tagged Unions, and Exhaustiveness

Status: Complete.

Goal: Make sum-like data types reliable and diagnosable for 0.1.

Rules for 0.1:

- Enums have explicit representation and scoped members.
- Tagged unions have documented tag representation, payload layout, constructors, accessors, and
  switch behavior.
- Switch over enum or tagged-union tags must support exhaustiveness diagnostics.
- Duplicate cases are rejected.
- Invalid payload access without matching tag/narrowing is rejected.

Deliverables:

- Document enum and tagged-union layout.
- Add exhaustiveness checker for enum and tagged-union switch forms.
- Add tests for constructors, payloads, switches, duplicate cases, missing cases, default handling,
  invalid payload access, and C emission.

Acceptance criteria:

- Exhaustive switches are accepted without default when all cases are covered.
- Non-exhaustive switches have a diagnostic naming missing cases.

---

# Phase 285: Control-Flow Analysis and Narrowing

Status: Complete.

Goal: Provide the minimum control-flow refinement expected for a 0.1 static language.

Rules for 0.1:

- Conditions must be `bool`.
- Return analysis must ensure non-void functions return on all paths.
- Unreachable code diagnostics are emitted where the compiler can prove unreachable code.
- Equality checks against enum members, literal union members, optional tags, and tagged-union tags
  narrow values inside the guarded block when the syntax is documented.
- Narrowing never changes runtime layout.

Deliverables:

- Document control-flow and narrowing rules.
- Add checker support for documented narrowing forms.
- Add tests for returns, unreachable statements, enum narrowing, optional narrowing, tagged-union
  narrowing, and non-narrowable expressions.

Acceptance criteria:

- Valid narrowed payload access is accepted.
- Invalid access outside a narrowed region is rejected.
- Non-void functions cannot fall through.

---

# Phase 286: Generics 0.1 Completion

Status: Complete.

Goal: Make compile-time monomorphized generics consistent across functions, classes, and aliases.

Rules for 0.1:

- Generic functions, classes, and type aliases use the same arity, substitution, and constraint
  rules.
- Explicit type arguments are checked before instantiation.
- Inferred type arguments are produced only when the inference rule is documented.
- Constraint kinds for 0.1 are exact primitive, exact literal, interface, and static record shape.
- Record-shape constraints include nested fields, optional/required modifiers, readonly/mutable
  modifiers, and multi-diagnostics.
- Recursive generic instantiation cycles are rejected with a cycle diagnostic.

Deliverables:

- Document generic declaration, instantiation, inference, monomorphized naming, and cycle rules.
- Audit generic functions/classes/aliases for consistent behavior.
- Add tests for explicit arguments, inferred arguments, constraints, nested records, classes,
  aliases, recursion cycles, duplicate instantiations, and emitted C names.

Acceptance criteria:

- The same invalid type argument fails consistently for function, class, and alias contexts.
- Recursive instantiation cannot hang or overflow.
- Duplicate monomorphizations are deduplicated deterministically.

---

# Phase 287: Type Alias, Type-Level, and Static-Only Type Rules

Status: Complete.

Goal: Freeze which type-level constructs are runtime layout types and which are static-only for 0.1.

Rules for 0.1:

- Scalar aliases and record aliases may be runtime layout types when their targets are layout types.
- Literal-only aliases are static-only.
- Conditional, mapped, reflection, union, and intersection aliases must either resolve to documented
  layout types or remain static-only and be rejected in runtime value/layout positions.
- Alias cycles are rejected.
- Type-level evaluation must terminate.

Deliverables:

- Document alias categories and runtime-layout eligibility.
- Add alias cycle detection if incomplete.
- Add tests for runtime aliases, static-only aliases, alias cycles, conditional aliases, mapped
  aliases, intersections, unions, and rejected runtime use.

Acceptance criteria:

- No static-only type reaches C type emission.
- Alias evaluation has bounded recursion and a clear cycle diagnostic.

---

# Phase 288: Function Types, Callbacks, and C ABI Function Pointers

Status: Complete.

Goal: Complete callable value semantics for 0.1.

Rules for 0.1:

- Function declarations have statically known signatures.
- Function type references describe callable signatures.
- Function pointer/callback representation is documented for TypeC-to-TypeC and TypeC-to-C calls.
- Capturing closures are rejected for 0.1.
- Optional function types remain rejected unless this phase defines and implements a concrete C
  representation.
- C extern function declarations follow the documented C ABI subset.

Deliverables:

- Document function type representation, callback conversion, extern function rules, and rejected
  closure forms.
- Add tests for function type annotations, callbacks, extern calls, invalid callbacks, variadic C
  externs, and optional function rejection.

Acceptance criteria:

- Callable values accepted by the checker have deterministic C declarators.
- Unsupported callable forms are rejected before emission.

---

# Phase 289: Module System, Namespaces, and Project Semantics

Status: Complete.

Goal: Make multi-file TypeC programs stable for 0.1.

Rules for 0.1:

- Imports are static.
- Named imports, aliased imports, namespace imports, default imports, and re-exports have documented
  resolution rules.
- Type-only imports and exports affect only type namespaces.
- Import cycles are rejected unless a specific cycle kind is documented as safe.
- Module path normalization and project dependency lookup are deterministic and platform-safe.
- Namespaces are compile-time grouping only unless a specific emitted C namespace behavior is
  documented.

Deliverables:

- Document module resolution, export selection, namespace use, project config, dependency paths, and
  cycle diagnostics.
- Add tests for all import/export forms, duplicate names, missing exports, cycles, project
  dependencies, path traversal rejection, and emitted C name stability.

Acceptance criteria:

- The same project resolves identically on Linux and Windows-style path inputs covered by tests.
- Invalid imports fail before checking dependent code.

---

# Phase 290: C Emission Specification and ABI Lock

Status: Complete.

Goal: Specify emitted C as a stable 0.1 target contract.

Rules for 0.1:

- Emitted C targets standard C11.
- Primitive typedefs map one-to-one from TypeC names to fixed-width C typedefs.
- Record, struct, class, tuple, optional, enum, tagged-union, slice, pointer, and borrowed-interface
  layouts are documented.
- Generated helper ordering is dependency-correct.
- Emitted identifiers are deterministic, collision-safe, and documented.
- C headers and generated source include only required headers.

Deliverables:

- Add `docs/c-emission.md`.
- Add native compile tests for representative generated C.
- Add tests for helper ordering, typedef ordering, emitted identifier collisions, header imports,
  and C ABI shape diagnostics.

Acceptance criteria:

- Valid 0.1 examples compile as C11 with clang and gcc.
- Invalid C ABI shapes produce TypeC diagnostics before generated C is compiled.

---

# Phase 291: Standard Library 0.1 Core

Status: Complete.

Goal: Ship a small documented standard library sufficient for real 0.1 programs.

Required 0.1 modules:

- `std/result`: `Result<T, E>` with constructors, tag checks, and unwrap helpers that are either
  statically safe or explicitly diagnostic-producing.
- `std/option`: optional helpers consistent with built-in optional representation.
- `std/slice`: length, indexing helpers, copy helpers, and fill helpers where already supported by
  lowering.
- `std/mem`: explicit memory utilities that do not hide allocation.
- `std/c`: C interop helpers and common C scalar aliases where needed.
- `std/test`: assertion helpers usable by TypeC examples and native smoke tests.

Deliverables:

- Implement only modules that can compile today with the 0.1 subset.
- Add `docs/stdlib.md`.
- Add examples for every public stdlib function/type.
- Add tests that import stdlib modules from normal projects.

Acceptance criteria:

- No stdlib API relies on a compiler special case unless that special case is documented.
- Every stdlib module has positive and negative tests.

---

# Phase 292: CLI, Build, Run, Check, Format, and Clean 0.1

Status: Complete.

Goal: Make command-line behavior predictable for standalone users.

Required commands:

- `STC check <file.tc>` validates without writing generated artifacts.
- `STC build <file.tc>` writes C and native build artifacts according to project config.
- `STC run <file.tc>` builds and executes a program with `main`.
- `STC emit-c <file.tc>` prints or writes C without native compilation.
- `STC fmt <paths...>` formats source files.
- `STC clean` removes generated artifacts owned by TypeC.
- `STC --version` prints compiler version.

Deliverables:

- Document CLI commands and exit codes.
- Add tests for success and failure paths for each command.
- Add tests for missing compiler, C compiler failure formatting, missing `main`, invalid project
  config, and clean safety.

Acceptance criteria:

- CLI commands never delete files outside documented generated directories.
- Check-only mode never writes artifacts.
- Error exit codes are stable and documented.

---

# Phase 293: Formatter 0.1 Stability

Status: Complete.

Goal: Ensure formatting is deterministic and safe for the 0.1 grammar.

Rules for 0.1:

- Formatting is idempotent.
- Comments are preserved.
- Unsupported syntax is not rewritten.
- Formatter output parses to an equivalent AST for supported syntax.

Deliverables:

- Document formatting guarantees.
- Add formatter tests for every 0.1 declaration, statement, expression, and type-reference form.
- Add idempotence tests for examples and stdlib.

Acceptance criteria:

- Running formatter twice produces identical output.
- Formatter cannot silently drop tokens or comments.

---

# Phase 294: LSP 0.1 Support

Status: Complete.

Goal: Provide reliable editor diagnostics and basic navigation for 0.1 code.

Required LSP features:

- publish diagnostics with stable diagnostic codes
- hover for declarations and type references
- go-to definition for local, module, type, function, class, interface, and enum symbols
- document symbols
- workspace symbols for opened project files
- semantic tokens for 0.1 syntax
- formatting request support
- inlay hints for inferred local and generic types where inference is documented

Deliverables:

- Document supported LSP capabilities.
- Add tests for each required feature.
- Add tests for invalid documents and partial edits.

Acceptance criteria:

- LSP diagnostics match CLI diagnostics for the same source.
- LSP never reports success for a document that the compiler rejects.

---

# Phase 295: Examples and Native Smoke Suite

Status: Complete.

Goal: Prove TypeC 0.1 is usable by shipping complete programs.

Required examples under `examples/0.1/`:

- hello/main returning status code
- arithmetic and primitive operations
- records and structs
- arrays, tuples, and slices
- optionals
- enums and tagged unions
- classes
- borrowed interfaces
- generics with constraints
- module imports and re-exports
- C extern call
- arena/safe pointer usage
- stdlib `Result`/`Option`/slice helpers

Deliverables:

- Add native build tests for all examples.
- Add README links to examples.
- Add expected generated C snapshots for selected representative examples.

Acceptance criteria:

- Every example builds from a clean checkout.
- No example uses undocumented syntax or compiler-internal behavior.

---

# Phase 296: Negative Test Matrix for Unsupported 0.1 Constructs

Status: Complete.

Goal: Make unsupported behavior explicit and regression-proof.

Deliverables:

- Add negative tests for every out-of-scope item listed in the 0.1 scope boundaries.
- Add negative tests for every unsupported runtime layout category.
- Add negative tests for every unsupported parser construct that resembles accepted syntax.
- Add negative tests proving static-only types cannot reach runtime layout positions.

Acceptance criteria:

- Unsupported constructs fail with documented diagnostic codes.
- No unsupported construct reaches lowering or C emission.

---

# Phase 297: Compiler Architecture and Dead-Code Audit

Status: Complete.

Goal: Remove implementation debt that would make 0.1 behavior ambiguous.

Deliverables:

- Audit parser, checker, lowerer, emitter, driver, module loader, and LSP code for unused exports,
  unused branches, compatibility shims, placeholder hooks, and unreachable helpers.
- Delete dead code.
- Split monolithic functions that violate single-responsibility boundaries.
- Add tests for behavior preserved by refactors.

Acceptance criteria:

- No placeholder code for post-0.1 features remains.
- No function contains unrelated parser/checker/lowering/emission responsibilities.
- Deno lint/type checks and full tests pass after cleanup.

---

# Phase 298: Performance and Termination Guardrails

Status: Complete.

Goal: Ensure the compiler terminates predictably on valid and invalid 0.1 projects.

Deliverables:

- Add recursion limits or visited-set checks for alias evaluation, generic instantiation, module
  dependency traversal, record-shape comparison, and type normalization.
- Add diagnostics for exceeded language recursion limits where appropriate.
- Add tests for large but valid programs and pathological invalid programs.

Acceptance criteria:

- Recursive aliases and recursive generic instantiations cannot hang the compiler.
- Invalid cyclic projects fail with diagnostics.
- Large representative 0.1 projects complete within documented test time limits.

---

# Phase 299: 0.1 Release Documentation and Version Gate

Status: Complete.

Goal: Prepare the first TypeC language release.

Deliverables:

- Update `README.md` to describe TypeC 0.1 as the current target.
- Add `CHANGELOG.md` entry for 0.1.
- Add `docs/0.1-release.md` with supported features, rejected features, install/build commands,
  examples, and known limitations.
- Add compiler version constant for `0.1.0` only after all checklist phases are complete.
- Add a release test that checks docs links, examples, full tests, build, and version output.

Acceptance criteria:

- The repository states exactly what TypeC 0.1 supports.
- The compiler reports `0.1.0` only when the full checklist is complete.
- No release documentation describes unimplemented behavior as supported.

---

# Phase 300: TypeC 0.1 Release Candidate

Status: Complete.

Goal: Final verification pass for TypeC 0.1.

Required checks:

```bash
deno fmt --check
deno test -A
deno task build
./bin/STC --version
./bin/STC check examples/0.1/main.tc
./bin/STC build examples/0.1/main.tc
./bin/STC run examples/0.1/main.tc
```

Deliverables:

- Freeze 0.1 docs.
- Freeze diagnostic code names for 0.1.
- Freeze emitted C ABI for 0.1-supported types.
- Tag the tested compiler state as the 0.1 release candidate.

Acceptance criteria:

- All 0.1 examples build and run where applicable.
- Full test suite passes with zero failures.
- Native C smoke suite passes.
- No known valid 0.1 program causes an internal error, uncaught exception, or invalid C emission.

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
