# TypeC TypeScript Syntax Support

TypeC 0.1.2 is the current 0.1 patch release. See [`docs/0.1-release.md`](docs/0.1-release.md) for
supported features, rejected features, commands, examples, and known limitations.

TypeC is a statically typed, C-emitting language with TypeScript-like syntax. It is **not** a
TypeScript runtime and does **not** implement JavaScript object, prototype, truthiness, `any`,
`null`/`undefined`, hidden allocation, or garbage-collected semantics.

For a deeper gap analysis, see [`docs/ts-feature-analysis.md`](docs/ts-feature-analysis.md).

## Install locally

Build the compiler as `./bin/STC`:

```sh
deno task build
```

Install it to `~/.local/bin/STC` and add that directory to `~/.bashrc`:

```sh
./install.sh
source ~/.bashrc
```

## Important honesty note

Several TS-looking features are still **partially implemented**. General assignment targets are now
implemented, so mutable record fields and array elements can be updated:

```ts
x = x + 1;
obj.x = 1;
arr[i] = value;
obj.pos.x += dx;
```

Borrowed interface values are available through explicit reference-style `Interface&` types. Owning
interface values, structural interface conversion, and JavaScript-style object dispatch remain out
of scope.

## Support Matrix

| TypeScript feature                  | TypeC status       | Notes                                                                                                        |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Function declarations               | Implemented        | `function name(...): Type { ... }`; supports static default, optional, and rest parameters.                  |
| Primitive type names                | Implemented        | TypeC source uses `bool`, integer/float aliases like `i32`, `f32`, `usize`, and `void`.                      |
| Local `const`                       | Implemented        | Immutable local with initializer.                                                                            |
| Local `let`                         | Implemented        | Mutable local variable.                                                                                      |
| Module `const`                      | Implemented        | Compile-time constants in supported expressions.                                                             |
| Assignment `x = value`              | Implemented        | Statement-only; no assignment expression value.                                                              |
| Field assignment `obj.x = value`    | Implemented        | Static lvalue targets only.                                                                                  |
| Indexed assignment `arr[i] = value` | Implemented        | Static lvalue targets only.                                                                                  |
| Compound assignment                 | Implemented        | Statement-only; supports static lvalue targets.                                                              |
| Increment/decrement                 | Implemented        | Statement-only; supports integer static lvalue targets.                                                      |
| Assignment expressions              | Not implemented    | No JS expression-valued assignment.                                                                          |
| `if` / `else` / `else if`           | Implemented        | Conditions must be `bool`; no truthiness.                                                                    |
| `while`                             | Implemented        | Condition must be `bool`.                                                                                    |
| `do while`                          | Implemented        | Condition must be `bool`.                                                                                    |
| `for`                               | Implemented        | Basic counted loops.                                                                                         |
| `for..of`                           | Implemented        | Static iteration over arrays and slices; no JS iterator protocol.                                            |
| `for..in`                           | Implemented        | Static record/class field keys and enum members; no JS enumerable-property semantics.                        |
| `switch` / `case` / `default`       | Implemented        | Static subset.                                                                                               |
| `break`                             | Implemented        | Supported in control flow.                                                                                   |
| `continue`                          | Implemented        | Supported in `while`, `do while`, and basic `for` loops.                                                     |
| Empty statement `;`                 | Implemented        | No-op statement.                                                                                             |
| Arithmetic operators                | Implemented        | Static numeric typing.                                                                                       |
| Comparison operators                | Implemented        | Static typed result.                                                                                         |
| Conditional operator `?:`           | Implemented        | Branches checked statically.                                                                                 |
| Logical `!`, `&&`, `\|\|`           | Implemented        | `bool` only; `&&`/`\|\|` return `bool`, not operand values.                                                  |
| Bitwise operators                   | Implemented        | Integer-only; no JS numeric coercions.                                                                       |
| Nullish coalescing `??`             | Implemented        | Optional-type based, not JS `null`/`undefined`.                                                              |
| Optional construction               | Implemented        | `Some(value)` and `None()` infer from expected optional types; explicit type arguments remain accepted.      |
| Optional chaining                   | Implemented        | Optional-type based field/index/method access.                                                               |
| Non-null assertion                  | Implemented        | Optional-type based.                                                                                         |
| Numeric separators                  | Implemented        | Decimal literals like `1_000`.                                                                               |
| String literals                     | Implemented        | Double-quoted and single-quoted.                                                                             |
| Template literals                   | Implemented        | Plain backtick literals and compile-time literal interpolation; runtime interpolation rejected.              |
| Arrays                              | Partial            | Static arrays/slices, literals, indexing, mutation, `Array.fill`, slice helpers, and C interop.              |
| Array holes/sparse arrays           | Not implemented    | Intentionally no JS sparse arrays.                                                                           |
| Tuples                              | Implemented        | Fixed-size value tuples, tuple literals, and constant indexing; no JS array methods or sparse values.        |
| Records/object types                | Partial            | Static record aliases, optional fields, literals, field reads/writes, spread/rest; no index signatures.      |
| Record literal shorthand            | Implemented        | `{ x }` means `{ x: x }`.                                                                                    |
| Object spread/rest                  | Implemented        | Static record/class shapes only; direct field copies, no JS enumerability/prototypes/symbols.                |
| Dynamic property access             | Not implemented    | No default dynamic object model.                                                                             |
| Field access `obj.x`                | Implemented        | Static field read/write via assignment targets.                                                              |
| Index access `arr[i]`               | Implemented        | Static index read/write via assignment targets.                                                              |
| Named type references               | Implemented        | Includes qualified names.                                                                                    |
| Parenthesized type refs             | Implemented        | `(T)` grouping.                                                                                              |
| Function type refs                  | Implemented        | Example: `(value: i32) => i32`.                                                                              |
| Pointer/reference/slice type refs   | Implemented        | TypeC/C-oriented memory model.                                                                               |
| Type aliases                        | Partial            | Record, scalar, generic, tuple, union, intersection, conditional, mapped, and reflection aliases are static. |
| Enums                               | Implemented        | Static scoped enums with fixed representation.                                                               |
| Tagged unions                       | Implemented        | Explicit `union` declarations and `A \| B` type-alias sugar.                                                 |
| TS union types `A \| B`             | Implemented        | Type-alias sugar over tagged unions; existing constructor/payload syntax applies.                            |
| Intersection types `A & B`          | Implemented subset | Static record-shape composition in type aliases; no runtime merge/prototype behavior.                        |
| Classes                             | Partial            | Static layout, constructors, methods, and static inheritance lower to records/functions.                     |
| Class fields                        | Partial            | Static layout, constructor initialization, field assignment, and inherited field flattening.                 |
| Class methods                       | Partial            | Calls and inherited method reuse work; dispatch is static, not virtual.                                      |
| `this` in methods                   | Implemented subset | Field reads/method lowering; not JS receiver semantics.                                                      |
| Constructors                        | Implemented subset | Value-returning `new Class(...)`; no heap allocation, overloads, `super`, or parameter properties.           |
| Class `implements`                  | Implemented        | Explicit nominal interface contracts used by generics and borrowed interface conversion.                     |
| Class inheritance `extends`         | Partial            | Single concrete static base class; fields flatten and methods copy; no prototypes/subtyping/`super`.         |
| Method overriding                   | Partial            | Child method with same name replaces copied base method for static dispatch only.                            |
| Interfaces                          | Partial            | Static method signatures plus explicit borrowed `Interface&` views; owning interface values are rejected.    |
| Generics                            | Partial            | Compile-time generics/monomorphization; limited inference.                                                   |
| Generic constraints                 | Implemented        | `T extends InterfaceName` style constraints.                                                                 |
| Conditional/mapped types            | Implemented subset | Static non-distributive conditional aliases and concrete record mapped aliases.                              |
| Type inference                      | Partial            | Local inference, contextual literals/optionals, argument/result generics, and non-exported returns.          |
| Named imports                       | Implemented        | Static module imports.                                                                                       |
| Named import aliases                | Implemented        | `import { exported as local } from "..."`.                                                                   |
| Namespace imports                   | Implemented        | `import * as NS from "..."`; qualified use required.                                                         |
| Default imports                     | Implemented        | Static default export/import selection; no JS module object semantics.                                       |
| Re-exports                          | Implemented        | Static named and type-only re-exports; no live JS bindings.                                                  |
| Dynamic import                      | Not implemented    | No runtime module loader.                                                                                    |
| C extern functions                  | Implemented        | Checked C ABI subset.                                                                                        |
| C header imports                    | Partial            | Supported C declarations only; complex macros/C forms excluded.                                              |
| `defer`                             | Implemented        | TypeC feature, not TypeScript.                                                                               |
| Arenas/safe pointers                | Implemented        | TypeC systems features, not TypeScript.                                                                      |
| `any`                               | Not implemented    | Intentionally forbidden.                                                                                     |
| `unknown` / `never`                 | Not implemented    | Not yet specified.                                                                                           |
| `null` / `undefined` values         | Not implemented    | Optional types use explicit `Some<T>`/`None<T>`; no implicit JS nullish values.                              |
| Truthiness                          | Not implemented    | Conditions must be `bool`.                                                                                   |
| Exceptions `throw` / `try`          | Not implemented    | Not yet specified.                                                                                           |
| Async/await / promises              | Not implemented    | No JS runtime dependency.                                                                                    |
| Decorators                          | Not implemented    | Not yet specified.                                                                                           |
| JSX                                 | Not implemented    | Out of scope.                                                                                                |
| Prototypes / `eval`                 | Not implemented    | Intentionally forbidden.                                                                                     |

## Most important missing language work

1. **Generic type-system completeness**: add generic type aliases, broader contextual generic
   inference, deeper alias interactions, and constraint diagnostics that remain cascade-free.
2. **Static object and record type ergonomics**: expand indexed access, mapped types, utility types,
   readonly propagation, `as const`, and literal inference without adding JavaScript object
   semantics.
3. **Control-flow type refinement**: improve discriminant narrowing, equality narrowing,
   exhaustiveness checks, and tagged-union diagnostics while keeping checks compile-time only.
4. **Interface ergonomics**: keep explicit borrowed `Interface&` dispatch available while any future
   structural or owned interface value support waits for documented coherence, ambiguity, ownership,
   and allocation rules.
5. **Diagnostics and tooling behavior**: keep errors actionable, preserve exact source spans, avoid
   duplicate diagnostics, and keep LSP/CLI behavior delegated to the compiler.
6. **Spec tightening**: document each accepted TypeScript-like feature with its static TypeC
   semantics and explicitly reject JavaScript runtime-only behavior.

## TypeScript type-system TODO

These are planned/specification candidates only. They are not implemented until a later phase
explicitly documents syntax, semantics, lowering, diagnostics, and tests.

### Generic types and inference

- Deeper generic type alias interactions with conditional/mapped/utility aliases.
- Recursive generic inference through records, tuples, arrays, slices, pointers, function types, and
  nested named type arguments.
- Generic method and generic class inference edge cases, including overload and contextual return
  positions.
- Constraint diagnostics that report the root mismatch without cascaded unknown-type or assignment
  noise.

### Static object, record, and property types

- Deeper indexed access type evaluation, including nested record/tuple access.
- Static index-signature alternatives, if they can lower without dynamic property maps.
- More complete record spread/rest type computation.
- `satisfies` coverage for deeper static shapes and clearer mismatch diagnostics.
- `as const` for compile-time literal freezing without runtime freeze metadata.

### Conditional, mapped, and utility types

- Distributive conditional types only if finite, deterministic expansion rules are defined.
- Type-level `infer` only after explicit non-recursive scope and termination rules are documented.
- Mapped type key remapping and modifier transforms such as readonly/optional add/remove.
- Static utility aliases such as `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T>`, `Omit<T>`,
  and `Record<K, V>`.
- Template literal types for finite compile-time text unions.

### Literal types, unions, intersections, and narrowing

- Broader literal type inference for constants, records, tuples, and enum-like string unions.
- Exhaustiveness diagnostics for tagged unions and literal unions.
- Discriminant-field narrowing in `if` and `switch` statements.
- Equality narrowing for literal unions and tagged-union discriminants.
- `in`-style shape narrowing only if it remains static and does not imply JS property lookup.
- Intersection conflict rules for duplicate fields, readonly modifiers, functions, and incompatible
  layouts.

### Interfaces and structural typing

- Structural interface conversion only after coherence and ambiguity rules are specified.
- Owned interface/trait objects only after an explicit allocation, ownership, and lifetime model is
  selected.
- Borrowed interface conversion diagnostics for ambiguous or missing methods.
- Interface constraints over generic records/classes without hidden vtables unless explicitly
  requested by borrowed interface syntax.

### Readonly, modules, and unsupported TS features

- Comprehensive compile-time readonly propagation through records, tuples, arrays, mapped types, and
  generic aliases.
- Type-only namespace ergonomics where they remain static and do not create runtime module objects.
- Clear rejections or static alternatives for declaration merging, namespaces-as-values, decorators,
  exceptions, async/await, JSX, `any`, `unknown`, `never`, `null`, and `undefined`.

## TypeC 0.1 Examples

Complete 0.1 example programs live under [`examples/0.1`](examples/0.1):

- [`main.tc`](examples/0.1/main.tc)
- [`hello.tc`](examples/0.1/hello.tc)
- [`arithmetic.tc`](examples/0.1/arithmetic.tc)
- [`records_structs.tc`](examples/0.1/records_structs.tc)
- [`arrays_tuples_slices.tc`](examples/0.1/arrays_tuples_slices.tc)
- [`optionals.tc`](examples/0.1/optionals.tc)
- [`enums_unions.tc`](examples/0.1/enums_unions.tc)
- [`classes.tc`](examples/0.1/classes.tc)
- [`borrowed_interfaces.tc`](examples/0.1/borrowed_interfaces.tc)
- [`generics_constraints.tc`](examples/0.1/generics_constraints.tc)
- [`modules.tc`](examples/0.1/modules.tc)
- [`c_extern.tc`](examples/0.1/c_extern.tc)
- [`arena_safe_pointer.tc`](examples/0.1/arena_safe_pointer.tc)
- [`stdlib_helpers.tc`](examples/0.1/stdlib_helpers.tc)

## Planned phase roadmap

Completed implementation phases are documented in `TYPEC_PHASES.md` through Phase 300. The active
roadmap is the **TypeC 0.1 Completion Checklist**. These phases define 0.1 as the first
self-contained TypeC language release and require specification, diagnostics, lowering behavior,
examples, and tests for every supported construct.

## Latest documented phase

Latest completed phase: **Phase 300 — TypeC 0.1 Release Candidate**. The TypeC 0.1 completion track
is complete for the 0.1 release candidate.

Run the compiler with:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
