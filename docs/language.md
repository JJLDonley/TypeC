# TypeC Language Prototype

TypeC uses `.tc` files and TypeScript-like syntax, but compiles ahead-of-time to C.

## Current prototype subset

- Function declarations
- Required parameter and return type annotations
- Primitive types: `bool`, `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `usize`, `f32`, `f64`, `void`
- `return expr;`, `return;`, `while`, assignment, `let`, and `const` statements
- Integer literals, float literals, identifiers, calls, `+ - * / %`, and comparisons
- Postfix pointer operators `expr.&` and `expr.*`
- Record type aliases, record literals, and field access
- Fixed arrays `T[N]`, inferred local arrays `T[]`, array literals, and indexing
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

Standard-library imports use `std/` paths:

```ts
import { abs_i32 } from "std/math.tc";
```

`project.json` can define dependency aliases and compiler flags:

```json
{
  "dependencies": {
    "basic/math.tc": "std/math.tc"
  },
  "compiler": {
    "flags": ["-O2"]
  }
}
```

Compiler flags are appended to the native C compiler invocation. Entries must be flags, not extra source files. Flags cannot override TypeC-controlled build behavior such as the C standard, output path, input language, or artifact mode. Flags that need operands must use single-argument form such as `-Iinclude` or `-DNAME=VALUE`.

```json
{
  "compiler": {
    "flags": ["-O2", "-Wall"]
  }
}
```

Then source can import through the alias:

```ts
import { abs_i32 } from "basic/math.tc";
```

## Standard Library

The standard library is written in TypeC and is expected to use the full completed language, not only the initial core subset.

Current stdlib modules are simple because advanced features are not implemented yet. As features such as classes, methods, enums, generics, interfaces, tagged unions, pattern matching, safe pointers, defer, arenas, and compile-time constants are completed, stdlib APIs should be updated to use them where they improve clarity, safety, or reuse.

## Run

```bash
deno run -A src/main.ts run examples/main.tc
```
