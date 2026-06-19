# TypeC Language Prototype

TypeC uses `.tc` files and TypeScript-like syntax, but compiles ahead-of-time to C.

## Current prototype subset

- Function declarations
- Required parameter and return type annotations
- Primitive types: `bool`, `i8`, `i16`, `i32`, `i64`, `u8`, `u16`, `u32`, `u64`, `f32`, `f64`, `void`
- `return` statements with expressions
- `let` / `const` local declarations with explicit type annotations
- Integer literals, identifiers, calls, and `+ - * / %` binary expressions
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
