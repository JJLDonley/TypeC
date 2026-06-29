# TypeC Formatting 0.1

The TypeC formatter is deterministic for supported 0.1 source files.

## Guarantees

- Formatting a supported source file twice produces identical text.
- Line comments and block comments are preserved as source tokens.
- Formatter output for supported source parses to an equivalent AST.
- CLI/file formatting parses the source before writing. If parsing fails, the file is not rewritten.
- Formatter output uses two-space indentation and a final trailing newline.

## Scope

The 0.1 formatter supports the 0.1 grammar documented in `docs/language.md`, including:

- imports and exports
- constants, functions, type aliases, structs, enums, interfaces, classes, and tagged unions
- blocks, returns, variables, assignments, loops, conditionals, switches, break, continue, and defer
- primitive, pointer, reference, safe-pointer, slice, array, tuple, optional, record, function,
  generic, union, intersection, `keyof`, and `typeof` type references
- literals, calls, field access, method calls, indexing, optional chaining, non-null assertions,
  casts, unary expressions, binary expressions, conditional expressions, nullish coalescing,
  aggregate literals, and array helpers

## Non-goals

The formatter does not define semantics for unsupported syntax. Unsupported syntax is diagnosed
before CLI/file formatting writes changes.
