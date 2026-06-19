# TypeC Phase Document

TypeC is a low-level, strictly typed language using TypeScript-like syntax and compiling ahead-of-time to C.

Source files use the `.tc` extension.

```txt
example.tc -> TypeC compiler -> C -> native binary
```

TypeC is not JavaScript. TypeC is not TypeScript with a runtime. TypeC borrows TypeScript syntax where useful, but its semantics are static, predictable, and suitable for systems programming.

---

## Core Goal

Build a small, strict, native language that feels familiar to TypeScript users but behaves like a low-level compiled language.

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
- string literals, later
- operators
- punctuation
- comments
- EOF

Pointer, reference, slice, and array syntax requires these tokens to be preserved distinctly enough for parsing:

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
```

Then add low-level type syntax:

```ts
let pointer: i32* = value.&;
let reference: i32& = value.&;
let inferredArray: i32[] = values;
let fixedArray: i32[16] = values;
```

Parser rules:

- `T[]` means array of `T` with length inferred from initializer.
- `T[N]` means fixed-size array of `T` with compile-time length `N`.
- Slice syntax is still TBD; do not use `T[]` for slices.
- `T*` means pointer to `T`.
- `T&` means reference to `T`.
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
- `T*`, `T&`, `T[]`, and `T[N]` are distinct static types
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
deno run -A src/main.ts build examples/main.tc
deno run -A src/main.ts run examples/main.tc
deno run -A src/main.ts watch examples/main.tc
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

TypeC uses postfix, C-adjacent low-level type syntax instead of generic wrapper names.

```ts
T*          // pointer to T
T&          // reference to T
T[]         // array of T, length inferred from initializer
T[N]        // fixed-size array of T with compile-time length N
```

Slice syntax is intentionally unresolved for now. `T[]` is reserved for inferred-size arrays, not slices.

Examples:

```ts
function load(p: i32*): i32 {
  return p.*;
}

function byRef(v: i32&): i32 {
  return v;
}

function sum(values: i32[16]): i32 {
  let total: i32 = 0;
  let i: usize = 0;

  while (i < values.length) {
    total = total + values[i];
    i = i + 1;
  }

  return total;
}

function first(values: i32[16]): i32 {
  return values[0];
}

function localArray(): i32 {
  const values: i32[] = [1, 2, 3];
  return values[0];
}
```

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
- Use `T[]` and `T[N]` for arrays.
- Use `T*` and `T&` for pointer and reference types.
- Use postfix `expr.*` and `expr.&` for pointer/reference expressions.
- Reject prefix `*expr` and `&expr`.

## Do Not

- Do not add a garbage collector.
- Do not hide heap allocation behind normal object literals.
- Do not make arrays secretly dynamic JS arrays.
- Do not use `ptr<T>`, `slice<T>`, or `array<T, N>` as the primary surface syntax.
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

function main(): i32 {
  return add(abs_i32(1), max_i32(1, 2));
}
```

## `project.json`

`project.json` is optional. When present, it is searched from the input file directory upward.

Supported fields:

- `dependencies`: maps import aliases to `.tc` files.
- `compiler.flags`: extra native C compiler flags.

Dependency aliases are extensionless virtual import paths. They cannot be empty, contain empty or `.` path segments, be relative paths, absolute paths, URL-like paths, `std/` paths, file paths, or contain `..` segments.

Imports may target relative `.tc` files or relative `.h` headers. Dependency targets may be relative project paths, absolute paths, or `std/` paths. TypeC dependency targets use `.tc`; C header dependency targets use `.h` and are converted to explicit extern declarations through compiler AST output. Project `-I`, `-isystem`, `-D`, and `-U` flags are used while reading headers; relative `-I` and `-isystem` paths are resolved from the project directory. `std/` targets cannot contain `..` segments. Project-relative dependency targets cannot escape the project with `..` segments.

Compiler flag entries must be flags, not extra source files. They cannot override TypeC-controlled build behavior such as the C standard, output path, input language, or artifact mode. Flags that need operands must use single-argument form.

## Standard Library Policy

The standard library is normal TypeC code. It should use the strongest completed language features available.

Early stdlib modules may start with the current core subset only because later features do not exist yet. As classes, methods, enums, generics, interfaces, tagged unions, pattern matching, safe pointers, defer, arenas, and compile-time constants become available, stdlib modules should be refactored to use those features where they make APIs clearer, safer, or more reusable.

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

## Possible Syntax

```ts
extern function puts(s: u8*): i32;

export function main(): i32 {
  return 0;
}
```

## Do

- Define ABI rules clearly.
- Use C-compatible layouts.
- Require explicit external declarations.
- Allow header-generated extern declarations only when derived from compiler AST output.
- Keep name mangling predictable.
- Use existing postfix pointer type syntax (`T*`) in extern declarations.

## Do Not

- Do not guess C signatures.
- Do not silently change layout.
- Do not expose non-C-compatible features through C ABI.

---

# Phase 12: Compile-Time Constants

## Goal

Allow named values that are evaluated by the compiler and emitted as C constants or substituted literals.

## Syntax

TBD before implementation.

## Do

- Define exactly which expressions are compile-time evaluable.
- Keep evaluation deterministic and side-effect free.
- Reject values that cannot be represented in their declared TypeC type.
- Emit fixed-width C types and literals.

## Do Not

- Do not add macros as a substitute for typed constants.
- Do not evaluate function calls unless explicitly specified later.
- Do not introduce hidden runtime initialization.

---

# Phase 13: Defer

## Goal

Allow explicit scope-exit cleanup without hidden ownership semantics.

## Syntax

TBD before implementation.

## Do

- Define execution order precisely.
- Lower to explicit C statements.
- Run deferred actions on all local exits from the scope.
- Keep deferred expressions type-checked like normal statements.

## Do Not

- Do not implement exceptions.
- Do not hide allocation or ownership behavior.
- Do not allow control flow that cannot be lowered clearly to C.

---

# Phase 14: Enums

## Goal

Add simple closed sets of named integer values.

## Syntax

TBD before implementation.

## Do

- Define representation explicitly.
- Require deterministic discriminant values.
- Type-check enum values distinctly from raw integers unless conversion rules are specified.
- Emit portable C using TypeC fixed-width integer aliases.

## Do Not

- Do not add payloads in this phase.
- Do not add pattern matching in this phase.
- Do not rely on C enum implementation-defined sizes.

---

# Phase 15: Classes and Methods

## Goal

Add static-layout data types with associated functions, lowered predictably to records and functions.

## Syntax

TBD before implementation.

## Do

- Keep object layout static and C-compatible where possible.
- Lower methods to explicit functions with an explicit receiver.
- Reuse record field checking rules.
- Keep dispatch static.

## Do Not

- Do not add prototypes.
- Do not add runtime reflection.
- Do not add implicit heap allocation.
- Do not add inheritance in this phase.

---

# Phase 16: Safe Pointer Modes

## Goal

Add stricter pointer categories or annotations that improve safety while preserving explicit memory behavior.

## Syntax

TBD before implementation.

## Do

- Define each pointer mode's aliasing, nullability, and mutability rules.
- Keep lowering to C explicit and auditable.
- Reject unsafe conversions unless explicitly written and specified.
- Preserve existing raw pointer interop rules.

## Do Not

- Do not promise memory safety without enforceable rules.
- Do not infer ownership silently.
- Do not break C ABI compatibility for raw pointers.

---

# Phase 17: Arenas

## Goal

Add explicit region-style allocation as a standard memory-management pattern.

## Syntax

TBD before implementation.

## Do

- Make arena lifetime explicit.
- Define allocation failure behavior.
- Lower to portable C runtime support only if specified.
- Keep interaction with `defer` clear.

## Do Not

- Do not add garbage collection.
- Do not hide allocation behind ordinary value construction.
- Do not make arenas required for programs that do not use them.

---

# Phase 18: Interfaces

## Goal

Add compile-time constraints for generic or static-dispatch code.

## Syntax

TBD before implementation.

## Do

- Keep interfaces compile-time only unless runtime dispatch is explicitly specified later.
- Define satisfaction rules structurally or nominally before implementation.
- Require clear diagnostics for missing members.
- Keep generated C monomorphic and explicit.

## Do Not

- Do not add dynamic dispatch by accident.
- Do not add runtime type information.
- Do not copy TypeScript interface semantics blindly.

---

# Phase 19: Generics

## Goal

Allow reusable typed functions and data structures through compile-time instantiation.

## Syntax

TBD before implementation.

## Do

- Define monomorphization rules.
- Define generic type parameter constraints.
- Emit deterministic C names for instantiations.
- Keep diagnostics tied to source generic definitions and call sites.

## Do Not

- Do not add type erasure unless explicitly designed.
- Do not emit runtime generic metadata.
- Do not allow unconstrained operations on unknown types.

---

# Phase 20: Tagged Unions

## Goal

Add sum types with explicit variants and payloads.

## Syntax

TBD before implementation.

## Do

- Define representation as a tag plus payload storage.
- Require explicit construction of variants.
- Check payload types statically.
- Emit portable C structs/unions only after layout is specified.

## Do Not

- Do not rely on unspecified C layout.
- Do not add implicit conversions between variants.
- Do not require pattern matching in this phase.

---

# Phase 21: Pattern Matching

## Goal

Add exhaustive branching over enums and tagged unions.

## Syntax

TBD before implementation.

## Do

- Define exhaustiveness rules.
- Define binding and scope rules.
- Lower to explicit C control flow.
- Require all arms to be type-consistent.

## Do Not

- Do not add partial matching without diagnostics.
- Do not add runtime reflection.
- Do not implement before enums and tagged unions are stable.

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
deno run -A src/main.ts run examples/main.tc
```

This is the first milestone. Everything else comes after this works reliably.
