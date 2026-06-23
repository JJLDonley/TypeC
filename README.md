# TypeC TypeScript Syntax Support

TypeC is a statically typed, C-emitting language with TypeScript-like syntax. It is **not** a
TypeScript runtime and does **not** implement JavaScript object, prototype, truthiness, `any`,
`null`/`undefined`, hidden allocation, or garbage-collected semantics.

For a deeper gap analysis, see [`docs/ts-feature-analysis.md`](docs/ts-feature-analysis.md).

## Important honesty note

Several TS-looking features are only **partially implemented**. The largest current gap is
assignment targets: TypeC can assign to simple mutable local variables, but not yet to fields or
indexed elements.

```ts
x = x + 1; // implemented
obj.x = 1; // not implemented yet
arr[i] = value; // not implemented yet
obj.pos.x += dx; // not implemented yet
```

This means records, arrays, and classes are useful for static layout, construction, reads, calls,
and C emission, but they do not yet have normal TypeScript-style mutable object ergonomics.

## Support Matrix

| TypeScript feature                  | TypeC status       | Notes                                                                                                                        |
| ----------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Function declarations               | Implemented        | `function name(...): Type { ... }`; return types required.                                                                   |
| Primitive type names                | Implemented        | TypeC source uses `bool`, integer/float aliases like `i32`, `f32`, `usize`, and `void`.                                      |
| Local `const`                       | Implemented        | Immutable local with initializer.                                                                                            |
| Local `let`                         | Partial            | Mutable local variable, but only identifier assignment targets are implemented.                                              |
| Module `const`                      | Implemented        | Compile-time constants in supported expressions.                                                                             |
| Assignment `x = value`              | Partial            | Local identifiers only. Not an expression.                                                                                   |
| Field assignment `obj.x = value`    | Not implemented    | Critical missing feature.                                                                                                    |
| Indexed assignment `arr[i] = value` | Not implemented    | Critical missing feature.                                                                                                    |
| Compound assignment                 | Partial            | Statement-only and local identifiers only.                                                                                   |
| Increment/decrement                 | Partial            | Statement-only and local identifiers only.                                                                                   |
| Assignment expressions              | Not implemented    | No JS expression-valued assignment.                                                                                          |
| `if` / `else` / `else if`           | Implemented        | Conditions must be `bool`; no truthiness.                                                                                    |
| `while`                             | Implemented        | Condition must be `bool`.                                                                                                    |
| `do while`                          | Implemented        | Condition must be `bool`.                                                                                                    |
| `for`                               | Not implemented    | Use `while` for now.                                                                                                         |
| `for..of` / `for..in`               | Not implemented    | No iterable/dynamic-key semantics.                                                                                           |
| `switch` / `case` / `default`       | Implemented        | Static subset.                                                                                                               |
| `break`                             | Implemented        | Supported in control flow.                                                                                                   |
| `continue`                          | Not implemented    | Not yet specified.                                                                                                           |
| Empty statement `;`                 | Implemented        | No-op statement.                                                                                                             |
| Arithmetic operators                | Implemented        | Static numeric typing.                                                                                                       |
| Comparison operators                | Implemented        | Static typed result.                                                                                                         |
| Conditional operator `?:`           | Implemented        | Branches checked statically.                                                                                                 |
| Logical `!`, `&&`, `\|\|`           | Implemented        | `bool` only; `&&`/`\|\|` return `bool`, not operand values.                                                                  |
| Bitwise operators                   | Implemented        | Integer-only; no JS numeric coercions.                                                                                       |
| Nullish coalescing `??`             | Implemented        | Optional-type based, not JS `null`/`undefined`.                                                                              |
| Optional chaining                   | Implemented        | Optional-type based field/index/method access.                                                                               |
| Non-null assertion                  | Implemented        | Optional-type based.                                                                                                         |
| Numeric separators                  | Implemented        | Decimal literals like `1_000`.                                                                                               |
| String literals                     | Implemented        | Double-quoted and single-quoted.                                                                                             |
| Template literals                   | Not implemented    | No interpolation/runtime string model.                                                                                       |
| Arrays                              | Partial            | Static arrays/slices, literals, indexing reads, C interop; no indexed mutation or JS array API.                              |
| Array holes/sparse arrays           | Not implemented    | Intentionally no JS sparse arrays.                                                                                           |
| Tuples                              | Not implemented    | Not yet specified.                                                                                                           |
| Records/object types                | Partial            | Static record aliases, literals, field reads; no field assignment, optional fields, index signatures, or spread.             |
| Record literal shorthand            | Implemented        | `{ x }` means `{ x: x }`.                                                                                                    |
| Object spread/rest                  | Not implemented    | Not yet specified.                                                                                                           |
| Dynamic property access             | Not implemented    | No default dynamic object model.                                                                                             |
| Field access `obj.x`                | Implemented        | Read access only.                                                                                                            |
| Index access `arr[i]`               | Implemented        | Read access only.                                                                                                            |
| Named type references               | Implemented        | Includes qualified names.                                                                                                    |
| Parenthesized type refs             | Implemented        | `(T)` grouping.                                                                                                              |
| Function type refs                  | Implemented        | Example: `(value: i32) => i32`.                                                                                              |
| Pointer/reference/slice type refs   | Implemented        | TypeC/C-oriented memory model.                                                                                               |
| Type aliases                        | Partial            | Record aliases supported; scalar aliases rejected today.                                                                     |
| Enums                               | Implemented        | Static scoped enums with fixed representation.                                                                               |
| Tagged unions                       | Implemented        | Explicit `union` declarations, not TS `A \| B` type unions.                                                                  |
| TS union types `A \| B`             | Not implemented    | Use tagged unions instead.                                                                                                   |
| Intersection types `A & B`          | Not implemented    | Not yet specified.                                                                                                           |
| Classes                             | Partial            | Static layout and methods lower to records/functions; no constructors, inheritance, `implements`, or normal mutable methods. |
| Class fields                        | Partial            | Static layout and initialization; no field assignment.                                                                       |
| Class methods                       | Partial            | Calls work; mutation blocked by missing field assignment.                                                                    |
| `this` in methods                   | Implemented subset | Field reads/method lowering; not JS receiver semantics.                                                                      |
| Constructors                        | Not implemented    | Use record literals for initialization.                                                                                      |
| Class `implements`                  | Not implemented    | Important future static-contract feature.                                                                                    |
| Class inheritance `extends`         | Not implemented    | No superclass/prototype model.                                                                                               |
| Method overriding                   | Not implemented    | Requires inheritance/dispatch design.                                                                                        |
| Interfaces                          | Partial            | Static method signatures for generic constraints; not runtime values.                                                        |
| Generics                            | Partial            | Compile-time generics/monomorphization; limited inference.                                                                   |
| Generic constraints                 | Implemented        | `T extends InterfaceName` style constraints.                                                                                 |
| Conditional/mapped types            | Not implemented    | Not yet specified.                                                                                                           |
| Type inference                      | Partial            | Some local initializer cases; no full TS inference.                                                                          |
| Named imports                       | Implemented        | Static module imports.                                                                                                       |
| Named import aliases                | Implemented        | `import { exported as local } from "..."`.                                                                                   |
| Namespace imports                   | Implemented        | `import * as NS from "..."`; qualified use required.                                                                         |
| Default imports                     | Not implemented    | No JS default-module semantics.                                                                                              |
| Re-exports                          | Not implemented    | Not yet specified.                                                                                                           |
| Dynamic import                      | Not implemented    | No runtime module loader.                                                                                                    |
| C extern functions                  | Implemented        | Checked C ABI subset.                                                                                                        |
| C header imports                    | Partial            | Supported C declarations only; complex macros/C forms excluded.                                                              |
| `defer`                             | Implemented        | TypeC feature, not TypeScript.                                                                                               |
| Arenas/safe pointers                | Implemented        | TypeC systems features, not TypeScript.                                                                                      |
| `any`                               | Not implemented    | Intentionally forbidden.                                                                                                     |
| `unknown` / `never`                 | Not implemented    | Not yet specified.                                                                                                           |
| `null` / `undefined` values         | Not implemented    | Optional types are explicit; no implicit JS nullish values.                                                                  |
| Truthiness                          | Not implemented    | Conditions must be `bool`.                                                                                                   |
| Exceptions `throw` / `try`          | Not implemented    | Not yet specified.                                                                                                           |
| Async/await / promises              | Not implemented    | No JS runtime dependency.                                                                                                    |
| Decorators                          | Not implemented    | Not yet specified.                                                                                                           |
| JSX                                 | Not implemented    | Out of scope.                                                                                                                |
| Prototypes / `eval`                 | Not implemented    | Intentionally forbidden.                                                                                                     |

## Most important missing phases

1. **General assignment targets**: `obj.x = v`, `arr[i] = v`, `obj.pos.x += dx`.
2. **`for` loops**: counted loops without forcing verbose `while` syntax.
3. **Class `implements`**: explicit static contracts.
4. **Constructors**: structured initialization without record-literal-only construction.
5. **Inheritance or composition support**: only after a strict static/C layout spec.

## Latest documented phase

Latest completed phase: **Phase 37 — Named Import Aliases**.

Run the compiler with:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
