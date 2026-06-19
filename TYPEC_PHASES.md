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

int32_t main(void) {
  const int32_t x = 40 + 2;
  return x;
}
```

## Do

- Emit simple readable C.
- Include required C headers.
- Use fixed-width integer types from `<stdint.h>`.
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
  float x;
  float y;
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

Support multi-file TypeC projects.

## Example

```ts
import { add } from "./math.tc";

function main(): i32 {
  return add(1, 2);
}
```

## Do

- Resolve imports statically.
- Compile modules deterministically.
- Detect import cycles.
- Support explicit exports.

## Do Not

- Do not mimic Node module resolution fully.
- Do not require JavaScript package semantics.
- Do not make import behavior depend on runtime loading.

---

# Phase 11: Interop with C

## Goal

Allow TypeC to call C and expose C-compatible functions.

## Possible Syntax

```ts
extern function puts(s: ptr<u8>): i32;

export function main(): i32 {
  return 0;
}
```

## Do

- Define ABI rules clearly.
- Use C-compatible layouts.
- Require explicit external declarations.
- Keep name mangling predictable.

## Do Not

- Do not guess C signatures.
- Do not silently change layout.
- Do not expose non-C-compatible features through C ABI.

---

# Phase 12: Advanced TypeC Features

Only add after the core compiler is stable.

Possible features:

- generics
- tagged unions
- enums
- pattern matching
- interfaces as compile-time constraints
- methods
- safe pointer modes
- defer
- arenas
- compile-time constants
- package manager

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

int32_t main(void) {
  return 0;
}
```

Command:

```bash
deno run -A src/main.ts run examples/main.tc
```

This is the first milestone. Everything else comes after this works reliably.
