# TypeC Language Prototype

TypeC uses `.tc` files and TypeScript-like syntax, but compiles ahead-of-time to C.

## Current prototype subset

- Function declarations
- Required parameter and return type annotations
- Primitive types: `bool`, `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `usize`, `f32`, `f64`, `void`
- `return`, `while`, assignment, `let`, and `const` statements
- Integer literals, float literals, identifiers, calls, `+ - * / %`, and comparisons
- Postfix pointer operators `expr.&` and `expr.*`
- Record type aliases, record literals, and field access
- Fixed arrays `T[N]`, inferred local arrays `T[]`, array literals, and indexing
- `//` and `/* */` comments

## Example

```ts
function add(a: i32, b: i32): i32 {
  return a + b;
}

function main(): i32 {
  const x: i32 = add(20, 22);
  return x;
}
```

## Run

```bash
deno run -A src/main.ts run examples/main.tc
```
