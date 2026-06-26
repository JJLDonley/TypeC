# TypeC TypeScript Syntax Support

TypeC is a statically typed, C-emitting language with TypeScript-like syntax. It is **not** a
TypeScript runtime and does **not** implement JavaScript object, prototype, truthiness, `any`,
`null`/`undefined`, hidden allocation, or garbage-collected semantics.

For a deeper gap analysis, see [`docs/ts-feature-analysis.md`](docs/ts-feature-analysis.md).

## Important honesty note

Several TS-looking features are still **partially implemented**. General assignment targets are now
implemented, so mutable record fields and array elements can be updated:

```ts
x = x + 1;
obj.x = 1;
arr[i] = value;
obj.pos.x += dx;
```

The largest remaining ergonomic gap is runtime dispatch/interface values.

## Support Matrix

| TypeScript feature                  | TypeC status       | Notes                                                                                                     |
| ----------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| Function declarations               | Implemented        | `function name(...): Type { ... }`; return types required.                                                |
| Primitive type names                | Implemented        | TypeC source uses `bool`, integer/float aliases like `i32`, `f32`, `usize`, and `void`.                   |
| Local `const`                       | Implemented        | Immutable local with initializer.                                                                         |
| Local `let`                         | Implemented        | Mutable local variable.                                                                                   |
| Module `const`                      | Implemented        | Compile-time constants in supported expressions.                                                          |
| Assignment `x = value`              | Implemented        | Statement-only; no assignment expression value.                                                           |
| Field assignment `obj.x = value`    | Implemented        | Static lvalue targets only.                                                                               |
| Indexed assignment `arr[i] = value` | Implemented        | Static lvalue targets only.                                                                               |
| Compound assignment                 | Implemented        | Statement-only; supports static lvalue targets.                                                           |
| Increment/decrement                 | Implemented        | Statement-only; supports integer static lvalue targets.                                                   |
| Assignment expressions              | Not implemented    | No JS expression-valued assignment.                                                                       |
| `if` / `else` / `else if`           | Implemented        | Conditions must be `bool`; no truthiness.                                                                 |
| `while`                             | Implemented        | Condition must be `bool`.                                                                                 |
| `do while`                          | Implemented        | Condition must be `bool`.                                                                                 |
| `for`                               | Implemented        | Basic counted loops.                                                                                      |
| `for..of`                           | Implemented        | Static iteration over arrays and slices; no JS iterator protocol.                                         |
| `for..in`                           | Implemented        | Static record/class field keys and enum members; no JS enumerable-property semantics.                     |
| `switch` / `case` / `default`       | Implemented        | Static subset.                                                                                            |
| `break`                             | Implemented        | Supported in control flow.                                                                                |
| `continue`                          | Implemented        | Supported in `while`, `do while`, and basic `for` loops.                                                  |
| Empty statement `;`                 | Implemented        | No-op statement.                                                                                          |
| Arithmetic operators                | Implemented        | Static numeric typing.                                                                                    |
| Comparison operators                | Implemented        | Static typed result.                                                                                      |
| Conditional operator `?:`           | Implemented        | Branches checked statically.                                                                              |
| Logical `!`, `&&`, `\|\|`           | Implemented        | `bool` only; `&&`/`\|\|` return `bool`, not operand values.                                               |
| Bitwise operators                   | Implemented        | Integer-only; no JS numeric coercions.                                                                    |
| Nullish coalescing `??`             | Implemented        | Optional-type based, not JS `null`/`undefined`.                                                           |
| Optional construction               | Implemented        | Explicit `Some<T>(value)` and `None<T>()`; type argument required.                                        |
| Optional chaining                   | Implemented        | Optional-type based field/index/method access.                                                            |
| Non-null assertion                  | Implemented        | Optional-type based.                                                                                      |
| Numeric separators                  | Implemented        | Decimal literals like `1_000`.                                                                            |
| String literals                     | Implemented        | Double-quoted and single-quoted.                                                                          |
| Template literals                   | Implemented        | Plain backtick literals and compile-time literal interpolation; runtime interpolation rejected.           |
| Arrays                              | Partial            | Static arrays/slices, literals, indexing, indexed mutation, C interop; no JS array API.                   |
| Array holes/sparse arrays           | Not implemented    | Intentionally no JS sparse arrays.                                                                        |
| Tuples                              | Implemented        | Fixed-size value tuples, tuple literals, and constant indexing; no JS array methods or sparse values.     |
| Records/object types                | Partial            | Static record aliases, literals, field reads/writes, spread/rest; no optional fields or index signatures. |
| Record literal shorthand            | Implemented        | `{ x }` means `{ x: x }`.                                                                                 |
| Object spread/rest                  | Implemented        | Static record/class shapes only; direct field copies, no JS enumerability/prototypes/symbols.             |
| Dynamic property access             | Not implemented    | No default dynamic object model.                                                                          |
| Field access `obj.x`                | Implemented        | Static field read/write via assignment targets.                                                           |
| Index access `arr[i]`               | Implemented        | Static index read/write via assignment targets.                                                           |
| Named type references               | Implemented        | Includes qualified names.                                                                                 |
| Parenthesized type refs             | Implemented        | `(T)` grouping.                                                                                           |
| Function type refs                  | Implemented        | Example: `(value: i32) => i32`.                                                                           |
| Pointer/reference/slice type refs   | Implemented        | TypeC/C-oriented memory model.                                                                            |
| Type aliases                        | Partial            | Record aliases supported; scalar aliases rejected today.                                                  |
| Enums                               | Implemented        | Static scoped enums with fixed representation.                                                            |
| Tagged unions                       | Implemented        | Explicit `union` declarations and `A \| B` type-alias sugar.                                              |
| TS union types `A \| B`             | Implemented        | Type-alias sugar over tagged unions; existing constructor/payload syntax applies.                         |
| Intersection types `A & B`          | Implemented subset | Static record-shape composition in type aliases; no runtime merge/prototype behavior.                     |
| Classes                             | Partial            | Static layout, constructors, methods, and static inheritance lower to records/functions.                  |
| Class fields                        | Partial            | Static layout, constructor initialization, field assignment, and inherited field flattening.              |
| Class methods                       | Partial            | Calls and inherited method reuse work; dispatch is static, not virtual.                                   |
| `this` in methods                   | Implemented subset | Field reads/method lowering; not JS receiver semantics.                                                   |
| Constructors                        | Implemented subset | Value-returning `new Class(...)`; no heap allocation, overloads, `super`, or parameter properties.        |
| Class `implements`                  | Implemented        | Explicit static interface contracts; no runtime dispatch.                                                 |
| Class inheritance `extends`         | Partial            | Single concrete static base class; fields flatten and methods copy; no prototypes/subtyping/`super`.      |
| Method overriding                   | Partial            | Child method with same name replaces copied base method for static dispatch only.                         |
| Interfaces                          | Partial            | Static method signatures for generic constraints; not runtime values.                                     |
| Generics                            | Partial            | Compile-time generics/monomorphization; limited inference.                                                |
| Generic constraints                 | Implemented        | `T extends InterfaceName` style constraints.                                                              |
| Conditional/mapped types            | Implemented subset | Static non-distributive conditional aliases and concrete record mapped aliases.                           |
| Type inference                      | Partial            | Local inference, contextual literals/optionals, argument/result generics, and non-exported returns.       |
| Named imports                       | Implemented        | Static module imports.                                                                                    |
| Named import aliases                | Implemented        | `import { exported as local } from "..."`.                                                                |
| Namespace imports                   | Implemented        | `import * as NS from "..."`; qualified use required.                                                      |
| Default imports                     | Not implemented    | No JS default-module semantics.                                                                           |
| Re-exports                          | Not implemented    | Not yet specified.                                                                                        |
| Dynamic import                      | Not implemented    | No runtime module loader.                                                                                 |
| C extern functions                  | Implemented        | Checked C ABI subset.                                                                                     |
| C header imports                    | Partial            | Supported C declarations only; complex macros/C forms excluded.                                           |
| `defer`                             | Implemented        | TypeC feature, not TypeScript.                                                                            |
| Arenas/safe pointers                | Implemented        | TypeC systems features, not TypeScript.                                                                   |
| `any`                               | Not implemented    | Intentionally forbidden.                                                                                  |
| `unknown` / `never`                 | Not implemented    | Not yet specified.                                                                                        |
| `null` / `undefined` values         | Not implemented    | Optional types use explicit `Some<T>`/`None<T>`; no implicit JS nullish values.                           |
| Truthiness                          | Not implemented    | Conditions must be `bool`.                                                                                |
| Exceptions `throw` / `try`          | Not implemented    | Not yet specified.                                                                                        |
| Async/await / promises              | Not implemented    | No JS runtime dependency.                                                                                 |
| Decorators                          | Not implemented    | Not yet specified.                                                                                        |
| JSX                                 | Not implemented    | Out of scope.                                                                                             |
| Prototypes / `eval`                 | Not implemented    | Intentionally forbidden.                                                                                  |

## Most important missing phases

1. **Inheritance or composition support**: only after a strict static/C layout spec.

## Latest documented phase

Latest completed phase: **Phase 52 — Conditional and Mapped Types**.

Run the compiler with:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
