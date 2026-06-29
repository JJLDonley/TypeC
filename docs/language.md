# TypeC 0.1 Language Reference

TypeC is a strictly typed systems language that uses `.tc` source files and emits C ahead of native
compilation.

```txt
source.tc -> TypeC compiler -> C11 source -> native executable or object file
```

This document defines the TypeC 0.1 language target. A construct is part of 0.1 only when it is
listed in the supported subset below. A construct listed in the rejected subset must produce a TypeC
diagnostic before C emission.

Coverage anchors for the current implementation are the compiler tests under `tests/`, the runnable
examples under `examples/`, and the phase record in `TYPEC_PHASES.md`.

---

## 1. Terminology

- **Source file**: a UTF-8 `.tc` file parsed as one TypeC module.
- **Module**: one source file after imports are resolved.
- **Declaration**: a top-level import, export, constant, type alias, enum, union, struct, class,
  interface, extern function, or function.
- **Statement**: an executable item inside a block.
- **Expression**: a typed value computation.
- **Type reference**: syntax that names or constructs a TypeC type.
- **Value type**: a type that can appear in runtime value positions.
- **Runtime layout type**: a value type with a specified C representation.
- **Static-only type**: a type used only by the checker; it cannot be stored, passed, returned, or
  emitted as a C type.
- **Lvalue**: an assignable storage location accepted by assignment-target checking.
- **Rvalue**: a computed value that is not assignable storage.
- **Compile-time constant**: a value fully evaluated by the compiler.
- **C ABI type**: a TypeC type accepted at an `extern function` boundary.
- **Borrowed value**: a non-owning view over existing storage.
- **Owning value**: a value responsible for its own storage lifetime.

---

## 2. Source Files, Comments, and Tokens

Supported:

- file extension: `.tc`
- line comments: `// text`
- block comments: `/* text */`
- identifiers for values, types, modules, fields, methods, enum members, and variants
- decimal integer literals with optional numeric separators: `1_000`
- decimal float literals
- double-quoted strings
- single-quoted strings
- plain template literals without runtime interpolation
- static template literals whose interpolated values are compile-time constants

Rejected in 0.1:

- runtime template interpolation
- malformed numeric separators
- unterminated strings, templates, or comments
- tokens reserved for unsupported constructs when no 0.1 meaning is defined

Coverage:

- lexer tests: `tests/lexer_test.ts`
- parser tests: `tests/parser_test.ts`, `tests/parser_type_refs_test.ts`

---

## 3. Primitive Types

The primitive runtime layout types are:

```txt
bool
b8
i8 i16 i32 i64
u8 u16 u32 u64
usize
f32 f64
void
```

Primitive representation table:

| TypeC type | Meaning                        | C typedef target |
| ---------- | ------------------------------ | ---------------- |
| `bool`     | boolean source type            | `b8`             |
| `b8`       | boolean ABI/layout alias       | `bool`           |
| `i8`       | signed 8-bit integer           | `int8_t`         |
| `i16`      | signed 16-bit integer          | `int16_t`        |
| `i32`      | signed 32-bit integer          | `int32_t`        |
| `i64`      | signed 64-bit integer          | `int64_t`        |
| `u8`       | unsigned 8-bit integer         | `uint8_t`        |
| `u16`      | unsigned 16-bit integer        | `uint16_t`       |
| `u32`      | unsigned 32-bit integer        | `uint32_t`       |
| `u64`      | unsigned 64-bit integer        | `uint64_t`       |
| `usize`    | pointer-sized unsigned integer | `size_t`         |
| `f32`      | 32-bit floating-point value    | `float`          |
| `f64`      | 64-bit floating-point value    | `double`         |
| `void`     | no value                       | `void`           |

Rules:

- `bool` and `b8` represent boolean values.
- Integer types have the signedness and width named by the type.
- `usize` is pointer-sized and maps to C `size_t`.
- `f32` maps to C `float`.
- `f64` maps to C `double`.
- `void` is valid as a function return type and pointer pointee type.
- `void` is not a storable value type.
- Primitive TypeC names map one-to-one to emitted C typedef names.
- Integer literals are range-checked against their expected target type.
- Float literals are range-checked against their expected target type.

Primitive operation table:

| Operation family | Operators         | Operand rule                                  | Result rule       |
| ---------------- | ----------------- | --------------------------------------------- | ----------------- |
| arithmetic       | `+ - * /`         | matching numeric operand types                | operand type      |
| remainder        | `%`               | matching integer operand types                | operand type      |
| bitwise          | `& \| ^`          | matching integer operand types                | operand type      |
| shifts           | `<< >> >>>`       | integer left operand and unsigned shift count | left operand type |
| comparison       | `< <= > >= == !=` | matching comparable operand types             | `bool`            |
| logical          | `&&               |                                               | `                 |
| unary numeric    | `+ -`             | numeric operand                               | operand type      |
| unary bitwise    | `~`               | integer operand                               | operand type      |
| unary logical    | `!`               | `bool` operand                                | `bool`            |

Cast rules:

- `expr as T` and `@T(expr)` are equivalent explicit cast forms.
- Numeric casts are accepted only when source and target are numeric primitive types.
- Boolean, record, class, tuple, array, optional, pointer, reference, slice, function, interface,
  and static-only types are rejected by numeric casts.
- Pointer reinterpretation casts are not part of 0.1 cast syntax.
- TypeC does not perform implicit numeric widening in local initialization, assignment, return, or
  call argument checking.

Rejected in 0.1:

- implicit truthiness
- implicit numeric widening
- boolean-to-numeric casts
- numeric-to-boolean casts
- pointer reinterpretation casts
- raw C scalar names as ordinary TypeC primitive names unless imported through a supported C header

Coverage:

- primitive and expression tests: `tests/checker_expression_types_test.ts`, `tests/compiler_test.ts`
- C type emission tests: `tests/c_compiler_test.ts`, `tests/c_header_types_test.ts`

---

## 4. Declarations

Supported declaration forms:

```ts
import { name } from "./module.tc";
import { exported as local } from "./module.tc";
import * as NS from "./module.tc";
import DefaultName from "./module.tc";
export { name };
export { name as alias };
export type { TypeName };

const NAME: Type = value;
export const NAME: Type = value;

type Name = Type;
struct Name { field: Type; }
enum Name { Member = 1 }
union Name { Variant: Payload; Empty; }
interface Name { method(arg: Type): Return; }
class Name { field: Type; method(): Return { ... } }
extern function name(arg: Type): Return;
export extern function exported_name(arg: Type): Return;
function name(arg: Type): Return { ... }
export function name(arg: Type): Return { ... }
```

Rules:

- Declarations are resolved statically.
- Duplicate declarations in the same namespace are rejected.
- Type and value namespaces are separate where the compiler documents separate lookup behavior.
- Exported declarations are available to importing modules.
- `extern function` declarations have no TypeC body and must use supported C ABI types.
- `export extern function` exposes C interop declarations from `.tc` modules.
- Non-extern functions must have a body.

Rejected in 0.1:

- declaration merging
- namespaces as runtime values
- decorators
- ambient declarations without a supported TypeC meaning
- `extern const`

Coverage:

- declaration parser tests: `tests/parser_declarations_test.ts`
- resolver tests: `tests/resolver_test.ts`
- checker declaration tests: `tests/checker_declarations_test.ts`

---

## 5. Modules, Imports, Exports, and Projects

Supported import targets:

- relative TypeC files: `./file.tc`, `../dir/file.tc`
- relative C headers: `./header.h`, `../dir/header.h`
- standard-library paths: `std/name.tc`
- project dependency aliases from `project.json`

Supported import forms:

- named imports: `import { add } from "./math.tc"`
- renamed named imports: `import { add as sum } from "./math.tc"`
- namespace imports: `import * as Math from "./math.tc"`
- default imports: `import value from "./value.tc"`
- type-only imports and re-exports: `import type { Pair } ...`, `export type { Pair }`
- named re-exports: `export { add } from "./math.tc"`

Rules:

- Imports are static and are resolved before type checking imported declarations.
- Import paths use `/` separators; backslashes and encoded separators are rejected.
- Relative imports may target `.tc` source files or `.h` C headers.
- Standard-library imports use `std/name` or `std/name.tc` and cannot escape the standard-library
  root.
- Project dependencies are configured in `project.json`; dependency aliases are virtual import paths
  and package submodule imports cannot escape the package root.
- Default imports select the declaration named by `export default name;`; missing defaults are
  diagnostics.
- Type-only imports and exports select only type namespace declarations and do not import functions
  or constants.
- Namespace imports are compile-time grouping only. Referenced members lower to declarations named
  `Namespace.member` with deterministic C names such as `Namespace_member`; unused namespace members
  are not selected.
- Re-exports select declarations from another module and mark the selected roots exported from the
  current module.
- Header dependencies are read through clang AST output and exposed as TypeC declarations.
- Import cycles are rejected.
- Missing, ambiguous, duplicate, or invalid imports fail before checking dependent code.

Coverage:

- module tests: `tests/module_loader_test.ts`, `tests/module_paths_test.ts`,
  `tests/module_import_requests_test.ts`
- project tests: `tests/project_config_test.ts`, `tests/project_dependencies_test.ts`

---

## 6. Statements

Supported statement forms:

```ts
;
{
  statement;
}
const x: Type = value;
let x: Type = value;
let x = value;
return value;
return;
if (condition) statement else statement
while (condition) statement
do statement while (condition);
for (let i: i32 = 0; i < n; i = i + 1) statement
for (const value of arrayOrSlice) statement
for (const key in recordOrEnum) statement
switch (value) { case C: statement; default: statement; }
break;
continue;
defer call();
assignmentTarget = value;
assignmentTarget += value;
assignmentTarget -= value;
assignmentTarget *= value;
assignmentTarget /= value;
assignmentTarget %= value;
assignmentTarget++;
assignmentTarget--;
call();
```

Rules:

- Conditions must be `bool`.
- Assignment is statement-only.
- `break` exits the nearest loop or switch.
- `continue` continues the nearest loop.
- `defer` accepts a call expression and runs deferred calls in first-in, last-out order at scope
  exit.
- A non-void function must return a value on every accepted path.
- Statements after a statically terminating statement in the same block are diagnosed as
  unreachable.
- Statically terminating statements are `return`, `break`, `continue`, `if` with both branches
  terminating, `switch` with all cases and default terminating, and `do while` with a terminating
  body.

Narrowing rules:

- `if (value.tag == Union.Variant)` narrows `value` to `Variant` inside the `then` block.
- `switch (value.tag)` narrows `value` inside a case with exactly one scoped variant label such as
  `case Union.Variant:`.
- Tagged-union payload fields require matching tag narrowing.
- Narrowing is compile-time-only; it does not change runtime layout or emitted C representation.

Rejected in 0.1:

- assignment expressions
- expression-valued `++` or `--`
- `throw`
- `try` / `catch` / `finally`
- `await`
- coroutine statements
- labels and `goto`

Coverage:

- statement parser tests: `tests/parser_statements_test.ts`
- control-flow tests: `tests/checker_control_flow_test.ts`
- emitter statement tests: `tests/emitter_statements_test.ts`

---

## 7. Expressions

Supported expression categories:

- literals: integer, float, boolean, string, static template
- identifiers
- calls
- method calls
- field access: `value.field`
- optional field/method/index access: `value?.field`, `value?.method()`, `value?.[index]`
- index access: `value[index]`
- array literals
- tuple literals
- record literals
- record literal shorthand: `{ x }`
- record spread: `{ ...value, field: next }`
- pointer reference postfix: `value.&`
- pointer dereference postfix: `value.*`
- non-null assertion: `value!`
- unary `+`, `-`, `!`, `~`
- multiplicative `*`, `/`, `%`
- additive `+`, `-`
- comparisons `<`, `<=`, `>`, `>=`, `==`, `!=`
- logical `&&`, `||`
- nullish coalescing `??`
- Elvis shorthand `?:`
- conditional `condition ? whenTrue : whenFalse`
- casts where the checker accepts the source and target type pair
- `new Class(args)` for value-returning constructors
- `Some(value)` and `None()` optional constructors
- `satisfies` expressions as compile-time checks

Rules:

- `!`, `&&`, and `||` operate on `bool`.
- Bitwise operators operate on integer types.
- Arithmetic operators operate on numeric types accepted by the checker.
- `??` and `?:` require an optional left operand and a fallback assignable to the contained type.
- `expr!` requires an optional expression and returns the contained type.
- Optional chaining returns an optional result.
- Function and method calls use statically known signatures.

Rejected in 0.1:

- dynamic property access on records/classes by text key
- runtime reflection expressions
- `delete`
- `typeof` as a runtime expression
- `void expr` as a runtime expression
- comma expressions
- capturing closures

Coverage:

- expression parser tests: `tests/parser_expressions_test.ts`,
  `tests/parser_postfix_expressions_test.ts`
- checker tests: `tests/checker_expression_types_test.ts`, `tests/checker_calls_test.ts`
- emitter tests: `tests/emitter_expressions_test.ts`, `tests/emitter_calls_test.ts`

---

## 8. Assignment, Mutability, and Lvalues

Rules:

- Assignment is statement-only and has no expression value.
- Compound assignment is statement-only and has no expression value.
- Prefix and postfix increment/decrement are statement-only and have no expression value.
- Mutable local variables declared with `let` are assignable.
- Local constants declared with `const` are not assignable after initialization.
- A whole fixed-array local is not assignable after initialization.
- Mutable record, struct, and class fields are assignable when their root storage is mutable.
- `readonly` fields are not assignable after initialization.
- Array and slice elements are assignable when their root storage is mutable and the element type is
  assignable.
- Pointer dereference targets using `expr.*` are assignable when the pointer-like root accepted by
  the checker is mutable.
- Compound assignment and increment/decrement use the same lvalue validation as simple assignment.

Valid lvalue categories:

```txt
local
local.field
local[index]
local.field[index]
pointer.*
```

Rejected lvalue categories:

```txt
constLocal
readonlyField
arrayLocal
call() = value
(value + 1) = value
optional?.field = value
nonAssignableTemporary++
```

Coverage:

- assignment tests: `tests/compiler_test.ts`, `tests/checker_assignments_test.ts`
- parser assignment tests: `tests/parser_statements_test.ts`
- emitter assignment tests: `tests/emitter_assignments_test.ts`

---

## 9. Type References

Supported type-reference forms:

```ts
Name
Namespace.Name
(T)
Ptr<T>
Ref<T>
SafePtr<T>
Slice<T>
Array<T>
Array<T, N>
T*
T&
T[]
T[N]
T?
(value: A) => R
{ field: Type; readonly id: i32; optional?: Type; }
[A, B, C]
A | B
A & B
keyof T
typeof value
```

Rules:

- `T*` is equivalent to `Ptr<T>`.
- `T&` is equivalent to `Ref<T>` except when `T` is an interface name, where it denotes a borrowed
  interface view.
- `T[]` denotes an inferred-size array in local value positions and a pointer-decayed array in C ABI
  parameter positions.
- `T[N]` denotes a fixed-size array.
- `T?` denotes `Optional<T>` and is invalid for `void`.
- Function type references describe callable signatures.
- Record type references describe static record shapes.
- Tuple type references describe fixed positional value types.
- Literal type references and literal-only aliases are static-only unless a phase explicitly assigns
  runtime layout.

Rejected in 0.1:

- `any`
- `unknown`
- `never`
- implicit `null`
- implicit `undefined`
- index signatures
- runtime layout use of static-only types

Coverage:

- type parser tests: `tests/parser_type_refs_test.ts`
- type validation tests: `tests/checker_type_validation_test.ts`

---

## 10. Value Model and Initialization

Rules:

- Function parameters are initialized when the function body begins.
- Local `const` declarations require an initializer.
- Local `let` declarations require an initializer.
- A local without an initializer is invalid syntax in 0.1.
- A local can be read only after its declaration has initialized it.
- Branch-local declarations are scoped to their branch block and cannot be read outside that block.
- Record and struct literals must initialize every required field exactly once.
- Array literals must initialize every element of the target fixed array.
- Tuple literals must initialize every tuple position.
- Class values are initialized through record literals, constructor helpers, or generated class
  lowering accepted by the checker.
- Enum values are initialized through enum members.
- Tagged-union values are initialized through variant constructors.
- Optional values are initialized through `Some(value)` or `None()`.
- Pointer, reference, and safe-pointer values are initialized only by accepted pointer/reference
  expressions, C ABI values, or arena allocation forms.
- `{0}` is the explicit zero-initializer expression for aggregate contexts accepted by the checker.
- Copy behavior for 0.1 runtime layout values is value copy of the emitted representation.
- TypeC performs no implicit deep allocation during initialization or copy.

Rejected in 0.1:

- uninitialized local declarations
- reads of names outside their declared scope
- partially initialized required aggregate fields
- implicit default values for omitted required fields
- hidden allocation during copy

Coverage:

- declaration tests: `tests/parser_statements_test.ts`, `tests/parser_test.ts`
- aggregate tests: `tests/checker_array_literals_test.ts`, `tests/compiler_test.ts`
- emitter initialization tests: `tests/emitter_var_declarations_test.ts`,
  `tests/emitter_array_var_declarations_test.ts`

---

## 11. Constants

Module constants use explicit type annotations:

```ts
const SCREEN_WIDTH: i32 = 800;
export const SCREEN_HEIGHT: i32 = SCREEN_WIDTH + 50;
```

Rules:

- Module constants are compile-time values.
- Constant expressions may use literals, previous constants, record literals, array literals, unary
  numeric operators, and checked numeric binary operators.
- Constant expressions are range-checked against the annotated type.
- Division or modulo by zero in integer constants is rejected.
- Exported constants are visible to TypeC imports.
- Exported constants are not C ABI symbols.

Coverage:

- constant tests: `tests/checker_test.ts`, `tests/compiler_test.ts`
- example: `examples/constants.tc`

---

## 12. Records and Structs

Supported:

```ts
type Point = { x: i32; y: i32; };
struct Size { width: i32; height: i32; }
```

Rules:

- Records and structs are static data shapes.
- `struct` declares plain data only.
- A record type alias and a struct with the same fields have equivalent field access and literal
  checking rules.
- Field order is declaration order and determines emitted C layout order.
- Required fields must be initialized.
- Unknown literal fields are rejected.
- Optional fields use optional-value representation and default to `None()` when omitted.
- `readonly` fields are layout fields like ordinary fields, but cannot be assigned after
  initialization.
- Nested record and struct fields are initialized by nested record literals or assignable values.
- Field access is statically checked and supports nested field paths through known shapes.
- Field assignment requires a valid mutable lvalue and a non-readonly field.
- Record spread copies known fields from record-shaped operands in declaration order.
- Explicit fields after a spread override copied values for that field.
- Record rest destructuring copies the remaining known fields in declaration order into a generated
  record shape.
- Structs do not define methods, constructors, inheritance, interfaces, vtables, hidden metadata, or
  prototype behavior.

Rejected in 0.1:

- dynamic fields
- dynamic property lookup
- index signatures
- struct methods
- struct constructors
- struct inheritance
- unknown record literal fields
- assignment to readonly fields

Coverage:

- record checker tests: `tests/checker_record_literal_expressions_test.ts`, `tests/checker_test.ts`
- record emitter tests: `tests/emitter_record_types_test.ts`

---

## 13. Arrays, Tuples, and Slices

Supported forms:

```ts
const fixed: i32[3] = [1, 2, 3];
const canonical: Array<i32, 3> = [1, 2, 3];
const tuple: [i32, bool] = [1, true];
function sum(values: Slice<i32>): i32 {
  return 0;
}
```

Rules:

- Fixed arrays have compile-time length and homogeneous element type.
- `Array<T, N>` and `T[N]` are equivalent fixed-array spellings.
- `Array<T>` and local `T[]` are inferred-size array forms where accepted.
- Inferred arrays derive exact element type and length from a non-empty literal.
- Array literals in an expected fixed-array context must have exactly the expected length.
- Array literal elements must be assignable to the expected or inferred element type.
- Whole-array assignment is rejected; mutate individual elements through indexed lvalues.
- Tuple values have compile-time length and per-position element types.
- Tuple literals in an expected tuple context must have exactly the expected length.
- Tuple indexing requires a compile-time constant index.
- Tuple indexes must be within bounds.
- Array and tuple destructuring require no more binding targets than available elements.
- Slices are non-owning `{ data, length }` views.
- `Array<T, N>` can coerce to `Slice<T>` where a slice is expected.
- Slice literals are array literals checked in an expected `Slice<T>` context and cannot be empty
  unless an element type is otherwise known.
- Array `.data` exposes a raw pointer.
- Array and slice `.length()` return `usize`.
- Array and slice runtime indexing emits direct C indexing and is unchecked in TypeC 0.1.
- Compile-time-known tuple indexes and static slice helper bounds are checked by the compiler.
- `Array.fill(value)` initializes every element of an expected fixed-array target with `value`.
- `Array.fill((i) => expr)` initializes every element using a `usize` index parameter.
- `values.slice(start, end)` returns a non-owning `Slice<T>` view over `[start, end)`.
- Static `slice` helper bounds are checked when both indexes are integer literals.

Rejected in 0.1:

- sparse arrays
- array holes
- tuple dynamic indexes
- optional array types
- whole-array assignment
- empty array literals without an expected element type

Coverage:

- array tests: `tests/checker_array_literals_test.ts`,
  `tests/emitter_array_var_declarations_test.ts`
- tuple tests: `tests/compiler_test.ts`, `tests/emitter_tuple_types_test.ts`
- slice examples: `examples/slice_canonical.tc`

---

## 14. Optionals

Supported:

```ts
const present: i32? = Some(42);
const empty: i32? = None();
const value: i32 = present ?? 0;
```

Rules:

- `T?` is an optional value containing either present `T` or empty.
- `Some(value)` constructs a present optional.
- `None()` constructs an empty optional using expected type context.
- Explicit `Some<T>(value)` and `None<T>()` are accepted.
- Optional chaining propagates empty values.
- Non-null assertion unwraps and aborts at runtime if the value is empty.

Rejected in 0.1:

- `void?`
- optional arrays where no C representation is specified
- optional function types where no C representation is specified
- implicit absent values

Coverage:

- optional tests: `tests/checker_test.ts`, `tests/compiler_test.ts`
- optional C emission tests: `tests/emitter_type_aliases_test.ts`

---

## 15. Pointers, References, Safe Pointers, Arenas, and C Strings

Supported:

```ts
const p: Ptr<i32> = value.&;
const q: i32* = value.&;
const r: Ref<i32> = value.&;
const s: SafePtr<i32> = value.&;
const n: i32 = p.*;
```

Value categories:

- `Ptr<T>` and `T*` are raw non-owning pointers.
- `Ref<T>` and `T&` are non-owning references to existing storage.
- `SafePtr<T>` is a non-owning pointer-compatible value that is non-null by accepted construction.
- `Slice<T>` is a non-owning view containing pointer plus length.
- `Arena` owns a region of allocations and is destroyed explicitly.

Construction rules:

- `value.&` creates a pointer-like value from addressable storage.
- Addressable storage includes locals, parameters, fields, array elements, and dereferenced
  pointer-like values.
- Taking the address of a temporary expression is rejected.
- `Ptr<T>` may also come from checked C ABI forms such as compatible array decay and C string
  literals.
- `Ref<T>` cannot target `void`.
- `SafePtr<T>` can be constructed from `value.&` or from `arenaAlloc` in an expected `SafePtr<T>`
  context.
- Raw pointers do not implicitly convert to `SafePtr<T>`.
- `Array<T, N>` can coerce to `Slice<T>` where a slice is expected.
- Slice literals are array literals checked in an expected `Slice<T>` context.

Dereference and indexing rules:

- `value.*` dereferences `Ptr<T>`, `T*`, `Ref<T>`, `T&`, and `SafePtr<T>`.
- Dereferencing a non-pointer-like value is rejected before emission.
- Pointer dereference assignment targets using `value.* = expr` are accepted when the root value is
  mutable through the normal lvalue rules.
- Slice indexing uses the slice data pointer and requires a `usize`-compatible index.
- Array and slice `.length()` return `usize`.

Arena rules:

- `Arena` is an opaque runtime handle.
- `arenaCreate()` creates an arena.
- `arenaDestroy(arena)` destroys the whole arena region.
- `arenaAlloc(arena, count)` allocates `count` elements of the expected `SafePtr<T>` pointee type.
- `arenaAlloc` requires an expected `SafePtr<T>` target type.
- `arenaAlloc` count is checked as `usize`.
- Individual free of arena allocations is not supported.

Compiler-enforced safety:

- valid pointer/reference/safe-pointer type shapes
- addressable operands for `.&`
- pointer-like operands for `.*`
- no `Ref<void>`
- no implicit raw-pointer-to-safe-pointer assignment
- arena builtin arity and argument types
- arena allocation target context
- slice construction from compatible arrays/literals only

Caller responsibility in 0.1:

- raw pointer nullness
- raw pointer alignment and provenance across C ABI boundaries
- lifetime of references, raw pointers, safe pointers, and slices
- avoiding use of arena-derived pointers after `arenaDestroy`
- preventing concurrent mutation through aliases

Rejected in 0.1:

- hidden allocation
- implicit ownership inference
- individual free of arena allocations
- implicit raw-pointer-to-safe-pointer assignment
- pointer reinterpretation casts
- unchecked safe-pointer construction from raw pointers

C strings:

- String literals are NUL-terminated byte strings.
- String literals can initialize or pass to supported `u8` pointer/array C ABI forms.
- TypeC does not attach JS string object behavior to C strings.

Coverage:

- pointer tests: `tests/checker_test.ts`, `tests/compiler_test.ts`
- arena tests: `tests/checker_arenas_test.ts`
- C emission details: `docs/c-emission.md`
- examples: `examples/arena.tc`, `examples/c_string.tc`

---

## 16. Enums

Supported:

```ts
enum Key: i32 {
  Space = 32,
  Escape = 256,
}
```

Rules:

- Enum members are scoped under the enum name.
- Enum values have the enum type.
- Raw integers do not implicitly assign to enum types.
- Enum values do not implicitly assign to integer types.
- Duplicate member names are rejected.
- Duplicate member values are accepted.
- Named C header enums import as scoped enum types when all member values are deterministic `i32`
  values.
- Switches over enum values must cover every enum member unless a `default` case is present.
- Non-exhaustive enum switches report the missing scoped member names.

Coverage:

- enum tests: `tests/checker_test.ts`, `tests/compiler_test.ts`
- example: `examples/enum.tc`

---

## 17. Tagged Unions

Supported:

```ts
union MaybeI32 {
  Some: i32;
  None;
}

const value: MaybeI32 = MaybeI32.Some(42);
```

Rules:

- Variants are constructed with qualified calls.
- Payload variants store a payload of the declared type.
- Empty variants store only the tag.
- The tag is accessible through the documented `tag` field.
- Payload access uses the variant field name.
- `A | B` type-alias sugar is supported for checker-accepted tagged-union aliases.
- Switches over `value.tag` must cover every variant unless a `default` case is present.
- Non-exhaustive tagged-union switches report the missing scoped variant names.
- Duplicate switch cases are rejected.

Rejected in 0.1:

- pattern matching syntax
- unchecked payload access forms not accepted by the checker

Coverage:

- tagged-union tests: `tests/compiler_test.ts`
- example: `examples/tagged_union.tc`

---

## 18. Classes

Supported:

```ts
class Vec2 {
  x: f64;
  y: f64;

  lengthSquared(): f64 {
    return this.x * this.x + this.y * this.y;
  }
}
```

Rules:

- Classes are static-layout value types.
- Fields lower to C record fields in declaration order after inherited fields.
- Class values have no object header, prototype pointer, dynamic property map, or hidden allocator.
- Methods lower to C functions with an explicit receiver pointer for instance methods.
- Method names are deterministic: `Class_method` for concrete non-generic classes.
- Static methods lower to ordinary C functions without a receiver.
- Method dispatch is static and resolved from the compile-time receiver type.
- Constructors return initialized class values.
- A constructor body writes fields through `this`; emitted constructors initialize `this` with zero
  first.
- `new Class(args)` calls the value-returning constructor and does not allocate heap storage.
- Single concrete `extends` flattens inherited fields into the child layout before child fields.
- Inherited methods are copied for static dispatch under the child class name.
- A child method with the same name replaces the copied base method for static dispatch.
- Class values may be initialized with record literals where accepted by the checker.
- `implements` records nominal interface contracts.
- Borrowed interface views are the only runtime interface dispatch form and are documented in the
  interface section.

Rejected in 0.1:

- prototype behavior
- hidden heap allocation by `new`
- virtual dispatch
- `super`
- constructor inheritance
- parameter properties
- runtime class metadata attached to values
- dynamic instance fields

Coverage:

- class parser tests: `tests/parser_test.ts`
- class compiler tests: `tests/compiler_test.ts`
- example: `examples/class.tc`

---

## 19. Interfaces and Borrowed Interface Views

Supported:

```ts
interface Readable {
  read(): i32;
}

class File implements Readable {
  read(): i32 {
    return 1;
  }
}
```

Rules:

- Interfaces declare method signatures only.
- Interfaces are compile-time contracts.
- Interface method names must be unique.
- Interface method parameter and return types must be valid 0.1 types.
- Classes satisfy explicit `implements` declarations only when every required method exists with the
  exact parameter and return types.
- Generic interface constraints check static method satisfaction at compile time.
- `Interface&` and `Ref<Interface>` are explicit borrowed interface view spellings.
- Borrowed interface views are non-owning values containing a receiver pointer and method shims.
- Borrowed interface construction uses `value.&` in an expected borrowed interface context.
- Borrowed interface calls lower through generated receiver and function-pointer shims.
- Borrowed interface views do not allocate and do not own the receiver.
- Receiver lifetime remains the caller's responsibility.
- Owning interface values such as `Readable` are rejected.

Rejected in 0.1:

- owning interface values
- implicit structural conversion to owned interface values
- hidden boxing
- hidden allocation for interface dispatch
- runtime interface reflection
- interface inheritance

Coverage:

- interface tests: `tests/compiler_test.ts`, `tests/checker_test.ts`
- example: `examples/interface.tc`

---

## 20. Generics

Supported:

```ts
function id<T>(value: T): T {
  return value;
}
class Box<T> {
  value: T;
}
type Pair<T> = { left: T; right: T };
```

Rules:

- Generics are compile-time templates.
- Concrete uses are monomorphized before C emission.
- Monomorphized names are deterministic and include the concrete type arguments.
- Duplicate monomorphizations are emitted once.
- Explicit type arguments are checked for arity and constraints before instantiation.
- Inference is accepted only for implemented call and contextual positions.
- Supported constraint kinds are interface constraints, exact literal constraints, exact primitive
  constraints, and static record-shape constraints.
- Record-shape constraints check required fields, nested fields, field types, optional modifiers,
  and readonly modifiers.
- Constraint diagnostics report all supported sibling record-shape mismatches.
- Recursive generic instantiation cycles are rejected instead of recursing during lowering.

Rejected in 0.1:

- runtime generic values
- unchecked recursive generic instantiation
- unsatisfied constraints

Coverage:

- generic tests: `tests/compiler_test.ts`
- generic inference tests: `tests/lsp_server_test.ts`
- example: `examples/generic.tc`

---

## 21. Type Aliases and Static-Only Types

Supported alias categories:

- scalar aliases
- record aliases
- generic aliases
- tuple aliases
- union aliases
- intersection aliases for static record composition
- conditional aliases in the implemented static subset
- mapped aliases in the implemented static subset
- static reflection aliases in the implemented subset
- literal-only aliases as static-only types

Rules:

- Runtime aliases may be used only when their resolved target has runtime layout.
- Scalar, record, tuple, array, optional, pointer, reference, slice, enum, tagged-union, class, and
  function-signature aliases are runtime-layout eligible when all nested types are runtime-layout
  eligible.
- Literal-only aliases are static-only.
- Conditional, mapped, reflection, union, and intersection aliases are runtime-layout eligible only
  after lowering resolves them to a documented runtime-layout type.
- Static-only aliases may appear only in checker-only positions.
- Literal-only aliases cannot be used as value types.
- Runtime aliases cannot contain literal-only fields or elements.
- Alias constraints are checked before runtime layout emission.
- Alias dependency cycles are rejected before emission.

Rejected in 0.1:

- alias cycles
- static-only aliases in parameter, return, local, field, array element, tuple element, optional, or
  C ABI positions
- type-level evaluation that cannot terminate

Coverage:

- alias tests: `tests/compiler_test.ts`, `tests/emitter_type_aliases_test.ts`
- type-level parser tests: `tests/parser_type_refs_test.ts`

---

## 22. Function Types, Callbacks, and Extern Functions

Supported:

```ts
type Callback = (value: i32) => i32;
extern function qsort(data: Ptr<void>, count: usize, size: usize, compare: Callback): void;
```

Rules:

- Function declarations have statically known signatures.
- Function type references describe callable signatures.
- Compatible function symbols may be passed as callback arguments.
- Function-typed locals and parameters may be called directly.
- C extern functions use the checked C ABI subset.
- C variadic extern declarations use rest syntax accepted by the parser/checker.

Rejected in 0.1:

- capturing closures
- optional function types where no C representation is specified
- calling non-function values
- unsupported C declarator shapes

Coverage:

- callback tests: `tests/checker_calls_test.ts`, `tests/compiler_test.ts`
- C header function tests: `tests/c_header_function_test.ts`

---

## 23. C Header Interop

Supported header imports include representable forms of:

- functions
- fixed-width scalar types
- pointers
- fixed arrays
- typedef structs
- bare struct records
- deterministic constants
- simple object-like macros
- named enums with deterministic `i32` values
- function pointer parameters
- variadic extern functions

Rules:

- Header imports are virtual TypeC modules.
- Unsupported C declarations are skipped or diagnosed according to the header importer rule for that
  declaration kind.
- C `bool` and `_Bool` import as TypeC `bool` and emit as `b8`.
- `char*` and `const char*` import as `Ptr<u8>`.
- Fixed-width C integer types map to the matching TypeC primitive aliases.

Rejected in 0.1:

- function-like macros
- unsafe macros
- old-style function declarations
- array returns
- unknown signatures
- C forms without a documented TypeC ABI representation

Coverage:

- C header tests: `tests/c_header_function_test.ts`, `tests/c_header_types_test.ts`,
  `tests/c_header_record_field_types_test.ts`
- examples: `examples/c_header_namespace.tc`, `examples/c_header_project/main.tc`

---

## 24. C Emission Contract

Rules:

- Emitted C targets C11.
- Every translation unit includes fixed-width and boolean support headers.
- TypeC primitive names emit as same-named C typedefs.
- Emitted C never uses raw C primitive spellings for TypeC primitive declarations.
- Generated helper typedefs are emitted before dependent declarations.
- Static-only TypeC types never reach C type emission.
- Invalid programs fail before C emission.

Required C typedef block:

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

C ABI aliases are defined through these fixed-width TypeC aliases, not raw C integer spellings.

Coverage:

- C compiler tests: `tests/c_compiler_test.ts`
- emitter tests: `tests/emitter_translation_units_test.ts`, `tests/emitter_type_aliases_test.ts`

---

## 25. Standard Library Boundary

0.1 standard-library modules are TypeC source modules imported through `std/` paths. A standard
library API is valid only when it compiles using the 0.1 language subset and does not require a
compiler special case beyond documented builtins.

Supported current import style:

```ts
import { abs_i32 } from "std/math.tc";
```

Rules:

- Standard-library modules use normal TypeC imports and exports.
- Standard-library modules must not depend on hidden allocation.
- Standard-library modules must not expose unsupported runtime layout types.
- The 0.1 public stdlib surface is documented in `docs/stdlib.md`.
- The 0.1 command-line contract is documented in `docs/cli.md`.
- The 0.1 formatting contract is documented in `docs/formatting.md`.
- The 0.1 language-server contract is documented in `docs/lsp.md`.

Coverage:

- module loader std tests: `tests/module_loader_test.ts`

---

## 26. Explicitly Rejected 0.1 Constructs

The following constructs are outside TypeC 0.1 and must not lower to C:

- `any`
- `unknown`
- `never`
- implicit `null`
- implicit `undefined`
- truthiness
- dynamic property maps
- runtime reflection
- prototype mutation
- monkey patching
- garbage collection
- exceptions
- async functions
- promises
- coroutines
- decorators
- JSX
- `eval`
- runtime generic values
- owned interface values
- virtual class dispatch
- operator overloading
- user-defined implicit conversions
- capturing closures
- non-C backends

---

## 27. Running TypeC

Use the driver directly during development:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```

Use the built compiler after `deno task build`:

```bash
./bin/STC run examples/main.tc
./bin/STC check examples/main.tc
./bin/STC emit-c examples/main.tc
```
