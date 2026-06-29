# Changelog

## TypeC 0.1.2

Patch release for saved C extern modules:

- `emit-externs` now writes exported extern declarations so generated `.tc` files can be imported
  through normal namespace imports such as `import * as RL from "raylib";`.
- `export extern function` is now valid syntax for declaration-only C interop modules.
- Regenerated `raylib/raylib.tc` so the Raylib demo can use the saved extern module plus
  `project.json` linker flags.

## TypeC 0.1.1

Patch release for post-0.1 fixes:

- Added `STC emit-externs <header.h> [-o <file.tc>] [-- <clang flags...>]` for generating TypeC
  extern modules from C headers.
- Improved generated C-header extern support for enum constants such as Raylib `RL.KEY_A`.
- Fixed namespace member collection so namespace constants used as call arguments resolve correctly.
- Fixed C ABI record-alias recursion tracking so repeated struct field aliases, such as Raylib
  `Camera2D` fields using `Vector2`, are accepted as C ABI-compatible.

## TypeC 0.1.0

Release-candidate tag: `typec-0.1.0-rc.1`.

TypeC 0.1.0 is the first self-contained TypeC language release target.

### Supported

- Strict `.tc` source parsing, diagnostics, formatting, CLI, and LSP support for the documented 0.1
  subset.
- TypeScript-like declarations, statements, expressions, modules, classes, interfaces, generics,
  optionals, enums, unions, records, structs, arrays, tuples, slices, arenas, safe pointers, and C
  extern declarations where documented.
- Deterministic C11 emission using fixed-width TypeC primitive aliases and portable runtime helpers.
- Complete `examples/0.1/` suite with compile and native C smoke coverage.

### Rejected before C emission

- JavaScript runtime semantics including `any`, `unknown`, `never`, implicit `null`/`undefined`,
  truthiness, prototypes, dynamic property maps, async, exceptions, JSX, decorators, and dynamic
  imports.
- Unsupported runtime layouts such as owning interface values, unsupported function/optional
  declarators, and static-only type leakage into runtime positions.
- Cyclic aliases, recursive generic instantiations, cyclic module imports, and guarded pathological
  type-shape comparisons.

### Validation gate

The release gate is documented in `docs/0.1-release.md` and represented by
`tests/release_0_1_test.ts` plus the full build task:

```bash
deno fmt --check
deno task check
deno task lint
deno test -A
deno task build
./bin/STC --version
```
