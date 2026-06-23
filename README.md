# TypeC TypeScript Syntax Support

TypeC is a statically typed, C-emitting language with TypeScript-like syntax. It intentionally does
**not** implement JavaScript runtime semantics such as dynamic objects, prototypes, `any`,
truthiness, hidden allocation, or garbage collection.

## Support Matrix

| TypeScript feature                | TypeC status    | Notes                                                                        |
| --------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `.ts`-style function declarations | Implemented     | Uses `function name(...): Type { ... }`.                                     |
| Explicit return types             | Implemented     | Required for functions.                                                      |
| Primitive-looking type names      | Implemented     | Uses TypeC fixed/static names like `i32`, `f32`, `b8`, `usize`, `void`.      |
| `const` local declarations        | Implemented     | Statically typed; initializer required.                                      |
| `let` local declarations          | Implemented     | Mutable locals.                                                              |
| Module constants                  | Implemented     | `const NAME: Type = value;`.                                                 |
| `return` statements               | Implemented     | Checked against declared return type.                                        |
| Bare `return;`                    | Implemented     | For `void` functions only.                                                   |
| `if` / `else`                     | Implemented     | Condition must be `b8`; no truthiness.                                       |
| `else if`                         | Implemented     | Syntax sugar for nested `if`.                                                |
| `while`                           | Implemented     | Condition must be `b8`.                                                      |
| `do while`                        | Implemented     | Condition must be `b8`.                                                      |
| `switch`                          | Implemented     | Static checked subset.                                                       |
| `break`                           | Implemented     | For switch/control-flow use.                                                 |
| Empty statement `;`               | Implemented     | Emits C no-op.                                                               |
| Expression statements             | Implemented     | Restricted; no arbitrary JS expression semantics.                            |
| Arithmetic operators              | Implemented     | Static numeric typing.                                                       |
| Comparison operators              | Implemented     | Static typed results.                                                        |
| Conditional operator `?:`         | Implemented     | Statically typed branches.                                                   |
| Nullish coalescing `??`           | Implemented     | Optional-type based; no JS `null`/`undefined` dynamics.                      |
| Compact nullish `?:`              | Implemented     | TypeC optional fallback operator.                                            |
| Logical `!`                       | Implemented     | `b8` only.                                                                   |
| Logical `&&` / `                  |                 | `                                                                            |
| Bitwise `& \| ^ ~ << >> >>>`      | Implemented     | Integer-only; no JS numeric coercions.                                       |
| Compound assignment               | Implemented     | Statement-only: `+=`, `-=`, etc.                                             |
| Increment/decrement               | Implemented     | Statement-only: `x++`, `x--`; no expression value.                           |
| Assignment expressions            | Not implemented | Assignments are statements only.                                             |
| Prefix `++x` / `--x` expressions  | Not implemented | Avoids JS value semantics.                                                   |
| Postfix `x++` / `x--` expressions | Not implemented | Statement-only in TypeC.                                                     |
| Numeric literals                  | Implemented     | Integers/floats with static range checks.                                    |
| Decimal numeric separators        | Implemented     | Example: `1_000`. Invalid separator placement rejected.                      |
| Boolean literals                  | Implemented     | `true`, `false`.                                                             |
| Double-quoted strings             | Implemented     | C string interop subset.                                                     |
| Single-quoted strings             | Implemented     | Same semantics as double-quoted strings.                                     |
| Template literals                 | Not implemented | No interpolation or JS string runtime.                                       |
| Arrays                            | Implemented     | Static arrays/slices; no JS array object.                                    |
| Array literals                    | Implemented     | Statically typed; no holes.                                                  |
| Trailing commas                   | Implemented     | Supported in documented delimited lists.                                     |
| Array holes                       | Not implemented | No JS sparse arrays.                                                         |
| Tuples                            | Not implemented | Not yet specified.                                                           |
| Records / object type literals    | Implemented     | Static record types, e.g. `{ x: i32, y: i32 }`.                              |
| Record type `;` separators        | Implemented     | Original separator style.                                                    |
| Record type `,` separators        | Implemented     | TS-style field separators.                                                   |
| Optional record fields `x?: T`    | Not implemented | Not yet specified.                                                           |
| `readonly` fields                 | Not implemented | Not yet specified.                                                           |
| Index signatures                  | Not implemented | No dynamic property model.                                                   |
| Mapped types                      | Not implemented | Not yet specified.                                                           |
| Record literals                   | Implemented     | Static field checking.                                                       |
| Record literal field shorthand    | Implemented     | `{ x }` means `{ x: x }`.                                                    |
| Object spread                     | Not implemented | No JS object copy semantics.                                                 |
| Dynamic property access           | Not implemented | No default dynamic object model.                                             |
| Field access `a.b`                | Implemented     | Static fields / namespace-qualified symbols.                                 |
| Optional chaining                 | Implemented     | Optional-type based: fields, indexes, method calls.                          |
| Non-null assertion                | Implemented     | Optional-type based; checked statically.                                     |
| Named type references             | Implemented     | Includes qualified names.                                                    |
| Parenthesized type references     | Implemented     | `(T)` is syntax-only grouping.                                               |
| Pointer/reference type syntax     | Implemented     | TypeC/C-oriented memory model.                                               |
| Safe pointer type syntax          | Implemented     | For arena/safe pointer modes.                                                |
| Slice type syntax                 | Implemented     | Static C-emittable slice representation.                                     |
| Function type syntax              | Implemented     | Example: `(value: i32) => i32`.                                              |
| Type aliases                      | Implemented     | Record aliases currently supported for emitted C aliases.                    |
| Scalar type aliases               | Rejected        | Current checker rejects non-record aliases.                                  |
| `enum`                            | Implemented     | Static enum support.                                                         |
| Tagged unions                     | Implemented     | Explicit `union` subset.                                                     |
| Classes                           | Implemented     | Lowered to records + functions; no JS prototype semantics.                   |
| Class fields                      | Implemented     | Static layout.                                                               |
| Class methods                     | Implemented     | Lowered to functions with explicit receiver model.                           |
| Constructors                      | Not implemented | Not yet specified.                                                           |
| `this` keyword                    | Not implemented | No JS method receiver semantics.                                             |
| Class inheritance `extends`       | Not implemented | No superclass/prototype model.                                               |
| Method overriding                 | Not implemented | Requires future inheritance/dispatch design.                                 |
| Interfaces                        | Implemented     | Static contracts for generic constraints.                                    |
| Class `implements`                | Not implemented | Reasonable future phase; not yet specified.                                  |
| Generics                          | Implemented     | Functions/classes with static specialization support.                        |
| Generic constraints               | Implemented     | `extends` constraints against interfaces.                                    |
| Type argument lists               | Implemented     | Including trailing commas.                                                   |
| Conditional types                 | Not implemented | Not yet specified.                                                           |
| Union types `A \| B`              | Not implemented | Use explicit tagged `union` declarations instead.                            |
| Intersection types `A & B`        | Not implemented | Not yet specified.                                                           |
| Type inference                    | Partial         | Local initializer inference exists in supported cases; no TS-wide inference. |
| `import { name } from "..."`      | Implemented     | Static module imports.                                                       |
| Named import aliases              | Implemented     | `import { exported as local } from "..."`.                                   |
| Namespace imports                 | Implemented     | `import * as NS from "..."`; use `NS.name`.                                  |
| Default imports                   | Not implemented | No JS module default semantics.                                              |
| Re-exports                        | Not implemented | Not yet specified.                                                           |
| C header imports                  | Implemented     | Static C interop/header extraction subset.                                   |
| `extern function`                 | Implemented     | C ABI checked.                                                               |
| Variadic extern functions         | Implemented     | For C interop.                                                               |
| `defer`                           | Implemented     | TypeC feature, not TypeScript.                                               |
| Arenas                            | Implemented     | TypeC feature, not TypeScript.                                               |
| `any`                             | Not implemented | Intentionally forbidden.                                                     |
| `unknown`                         | Not implemented | Not yet specified.                                                           |
| `never`                           | Not implemented | Not yet specified.                                                           |
| `null` / `undefined` values       | Not implemented | Optional types are explicit; no implicit JS nullish values.                  |
| Truthiness                        | Not implemented | Conditions must be `b8`.                                                     |
| `eval`                            | Not implemented | Intentionally forbidden.                                                     |
| Prototypes                        | Not implemented | Intentionally not JavaScript-compatible.                                     |
| Garbage-collected objects         | Not implemented | Memory is explicit / C-oriented.                                             |
| Async/await                       | Not implemented | Not yet specified.                                                           |
| Promises                          | Not implemented | No JS runtime dependency.                                                    |
| Exceptions `throw` / `try`        | Not implemented | Not yet specified.                                                           |
| Decorators                        | Not implemented | Not yet specified.                                                           |
| JSX                               | Not implemented | Out of scope.                                                                |

## Latest Documented Phase

Latest completed phase: **Phase 37 — Named Import Aliases**.

Run the compiler with:

```bash
deno run -A src/driver/main.ts run examples/main.tc
```
