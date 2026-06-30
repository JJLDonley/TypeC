# TypeC 0.1.2

TypeC 0.1.2 is a statically typed systems language with TypeScript-like syntax that emits portable
C11. It is **not** TypeScript, JavaScript, or a JavaScript runtime. There is no `any`, no
`undefined`, no prototype model, no hidden garbage collector, no dynamic object maps, and no JS
truthiness.

TypeC 0.1.2 is the current patch release in the TypeC 0.1 release line.

- Release notes: [`docs/0.1-release.md`](docs/0.1-release.md)
- Release candidate notes: [`docs/0.1-release-candidate.md`](docs/0.1-release-candidate.md)
- CLI reference: [`docs/cli.md`](docs/cli.md)
- Diagnostics reference: [`docs/diagnostics.md`](docs/diagnostics.md)
- C emission reference: [`docs/c-emission.md`](docs/c-emission.md)
- Language reference: [`docs/language.md`](docs/language.md)
- LSP reference: [`docs/lsp.md`](docs/lsp.md)
- Standard library reference: [`docs/stdlib.md`](docs/stdlib.md)
- Changelog: [`CHANGELOG.md`](CHANGELOG.md)

## Install and verify TypeC 0.1.2

TypeC 0.1.2 is built with Deno. Before installing `STC`, make sure Deno is installed and build the
compiler binary from this repository:

```sh
deno task build
```

Only after the Deno build succeeds, install `STC` into `~/.local/bin/STC`:

```sh
./install.sh
source ~/.bashrc
```

Verify the exact version:

```sh
STC --version
# TypeC 0.1.2
```

The repo-local binary is built at:

```sh
./bin/STC --version
# TypeC 0.1.2
```

## Quick start

Create `main.tc`:

```ts
function square(value: i32): i32 {
  return value * value;
}

function main(): i32 {
  return square(6) - 36;
}
```

Check, build, and run:

```sh
STC check main.tc
STC build main.tc
STC run main.tc
```

Or from source during development:

```sh
deno run -A src/driver/main.ts check main.tc
deno run -A src/driver/main.ts build main.tc
deno run -A src/driver/main.ts run main.tc
```

## What TypeC 0.1.2 is

TypeC 0.1.2 is a small, self-contained language release focused on deterministic native programs:

- TypeScript-like syntax where it helps readability.
- Strict static type checking.
- Deterministic C11 emission.
- Fixed-width primitive aliases such as `i32`, `u64`, `f32`, `bool`, and `usize`.
- Explicit C interop through `extern function` and C header import/generation tools.
- Static modules, namespace imports, re-exports, classes, borrowed interfaces, generics, tagged
  unions, arrays, tuples, slices, optionals, arenas, and safe pointers.

TypeC 0.1.2 intentionally avoids JavaScript runtime semantics:

- No `any`.
- No implicit `undefined` or `null`.
- No truthiness: conditions must be `bool`.
- No prototype inheritance.
- No dynamic property maps.
- No reflection runtime.
- No hidden heap allocation.
- No garbage collector.
- No async/promise runtime.

## CLI commands in TypeC 0.1.2

```sh
STC --version
STC check <file.tc>
STC build <file.tc> [--build-dir <dir>]
STC run <file.tc> [--build-dir <dir>]
STC clean [--build-dir <dir>]
STC fmt <file.tc>
STC syntax <file.tc>
STC watch <file.tc> [--build-dir <dir>]
STC lsp
STC emit-externs <header.h> [-o <file.tc>] [-- <clang flags...>]
```

Examples:

```sh
STC check examples/0.1/main.tc
STC build examples/0.1/main.tc
STC run examples/0.1/main.tc
```

Generate TypeC extern declarations from a C header:

```sh
STC emit-externs raylib.h -o raylib.tc -- -I/path/to/include
```

The generated `.tc` file can be imported as a normal TypeC module:

```ts
import * as RL from "./raylib.tc";

function main(): i32 {
  RL.InitWindow(720, 720, "TypeC");
  RL.CloseWindow();
  return 0;
}
```

Native compiler/linker flags still belong in `project.json`.

## Project configuration

TypeC 0.1.2 reads `project.json` near the entry file. Project dependencies map static import names
to TypeC modules or C headers. Compiler flags are passed to the native C compiler.

Example:

```json
{
  "dependencies": {
    "raylib": "/path/to/raylib.h"
  },
  "compiler": {
    "flags": [
      "-I/path/to/include",
      "-L/path/to/lib",
      "-lraylib",
      "-lm",
      "-ldl",
      "-lpthread",
      "-lGL",
      "-lrt",
      "-lX11"
    ]
  }
}
```

Then source can use:

```ts
import * as RL from "raylib";
```

TypeC 0.1.2 LSP diagnostics and inlay hints are project-aware for real `file://` documents.

## Language overview for TypeC 0.1.2

### Functions

```ts
function add(left: i32, right: i32): i32 {
  return left + right;
}
```

`main` is the native entry point:

```ts
function main(): i32 {
  return 0;
}
```

### Variables

```ts
const immutable: i32 = 10;
let mutable: i32 = 20;
mutable += immutable;
```

Local type inference is supported:

```ts
const value = 42; // inferred i32
```

### Control flow

```ts
if (value > 0) {
  return value;
} else {
  return 0;
}
```

Conditions must be `bool`. Braced blocks are required.

Loops:

```ts
let i: i32 = 0;
while (i < 10) {
  i++;
}
```

### Records

```ts
type Vec2 = {
  x: f32;
  y: f32;
};

const p: Vec2 = { x: 1.0, y: 2.0 };
```

Records are static value layouts. They are not JavaScript objects.

### Arrays, tuples, and slices

```ts
const values: i32[3] = [1, 2, 3];
const first: i32 = values[0];
```

Static arrays have fixed length. Slices are explicit views; there is no JavaScript array runtime.

### Optionals

TypeC optionals are explicit static optional values, not JS `null`/`undefined`:

```ts
function maybe(flag: bool): i32? {
  if (flag) {
    return Some(42);
  }
  return None();
}
```

Optional chaining and nullish coalescing are optional-type based.

### Enums and tagged unions

```ts
enum Mode {
  Menu,
  Playing,
  GameOver,
}

union Result {
  Ok: i32;
  Err: i32;
}
```

Tagged unions are explicit runtime layouts emitted to C.

### Classes in TypeC 0.1.2

Classes are static value-layout types. They are not JavaScript objects.

```ts
class Counter {
  value: i32;

  add(delta: i32): i32 {
    return this.value + delta;
  }
}

function main(): i32 {
  const counter: Counter = { value: 40 };
  return counter.add(2) - 42;
}
```

Important class rules in TypeC 0.1.2:

- Class values have static C-compatible layout where supported.
- Methods lower to deterministic C functions.
- `this.method()` works inside methods in TypeC 0.1.2.
- Dispatch is static unless using explicit borrowed interfaces.
- No prototype chain.
- No hidden object header.
- No heap allocation for `new`.
- No JS `super` semantics.

### Interfaces in TypeC 0.1.2

Interfaces are static method contracts. Borrowed interface values are explicit non-owning views:

```ts
interface Readable {
  get(): i32;
}

class Box implements Readable {
  value: i32;

  get(): i32 {
    return this.value;
  }
}

function read(value: Readable&): i32 {
  return value.get();
}

function main(): i32 {
  const box: Box = { value: 42 };
  const readable: Readable& = box.&;
  return read(readable) - 42;
}
```

Owning interface values are intentionally not supported in TypeC 0.1.2.

### Generics

TypeC 0.1.2 supports compile-time generics and monomorphization:

```ts
function identity<T>(value: T): T {
  return value;
}

function main(): i32 {
  return identity(42) - 42;
}
```

Generic constraints are supported with interface constraints.

### Modules

Named imports:

```ts
import { add } from "./math.tc";
```

Namespace imports:

```ts
import * as Math from "./math.tc";
```

Default imports and re-exports are supported as static compile-time module operations. There is no
dynamic module loader.

### C interop

Declare C functions:

```ts
extern function puts(text: u8*): i32;
```

Export extern declarations from generated modules:

```ts
export extern function cosf(value: f32): f32;
```

TypeC 0.1.2 checks a supported C ABI subset before emission.

## Standard library in TypeC 0.1.2

The TypeC 0.1.2 standard library is intentionally small and ABI-safe:

- `std/c`
- `std/math`
- `std/mem`
- `std/option`
- `std/result`
- `std/slice`
- `std/test`

Examples live in:

- [`examples/std_c.tc`](examples/std_c.tc)
- [`examples/std_math.tc`](examples/std_math.tc)
- [`examples/std_mem.tc`](examples/std_mem.tc)
- [`examples/std_option.tc`](examples/std_option.tc)
- [`examples/std_result.tc`](examples/std_result.tc)
- [`examples/std_slice.tc`](examples/std_slice.tc)
- [`examples/std_test.tc`](examples/std_test.tc)

## TypeC 0.1.2 examples

Complete TypeC 0.1 examples live in [`examples/0.1`](examples/0.1):

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
- [`main.tc`](examples/0.1/main.tc)

Raylib demo:

- [`raylib/main.tc`](raylib/main.tc)
- [`raylib/project.json`](raylib/project.json)

The Raylib demo uses TypeC 0.1.2 classes for game entities and managers (`Player`, `World`,
`Asteroid`, `UI`, managers) plus static C interop through Raylib declarations.

## LSP and editor support

TypeC 0.1.2 includes an LSP server:

```sh
STC lsp
```

The VSCode extension in [`vscode-extension`](vscode-extension) starts the LSP for `.tc` files.

Supported LSP features include diagnostics, formatting, hover, definitions, declarations,
references, rename, inlay hints, semantic tokens, document symbols, folding, selection ranges, code
lens, and call hierarchy.

TypeC 0.1.2 inlay hints include inferred local variable types. For example:

```ts
const c = cosf(angle);
```

can display as:

```ts
const c: f32 = cosf(angle);
```

## Diagnostics

Diagnostics use stable codes documented in [`docs/diagnostics.md`](docs/diagnostics.md). Example
categories include:

- name resolution
- type checking
- records
- modules
- control flow
- field access
- operators
- generics
- C ABI compatibility
- parser and lexer diagnostics

Every diagnostic is intended to be actionable and deterministic.

## C emission guarantees in TypeC 0.1.2

TypeC 0.1.2 emits portable C11.

Important guarantees:

- Fixed-width primitive aliases are emitted in the C prelude.
- TypeC primitive names map one-to-one to C typedef names where possible.
- Class methods lower to deterministic C functions.
- Borrowed interface calls lower to explicit fat views and generated shims.
- No JavaScript runtime is emitted.
- Standard C headers are emitted only when required by the generated program.

See [`docs/c-emission.md`](docs/c-emission.md).

## Known limitations in TypeC 0.1.2

TypeC 0.1.2 is a complete 0.1 release line, but it is not a complete TypeScript replacement and not
yet self-hosting.

Major limitations:

- No general heap allocation API.
- No owned strings.
- No general dynamic arrays or maps.
- No async/await.
- No exceptions.
- No `any`, `unknown`, or `never`.
- No `null` or `undefined` values.
- No JavaScript runtime objects.
- No prototype inheritance.
- No structural interface conversion beyond explicit borrowed interface views.
- No owning interface values.
- C header support intentionally accepts only supported ABI-safe declarations.

Self-hosting the TypeC compiler is not expected in TypeC 0.1.2. A future bootstrap path needs
allocator support, owned strings, dynamic collections, file/process APIs, parser-friendly buffers,
and a larger package/build story.

## Development validation

Before committing TypeC compiler changes, run:

```sh
deno fmt --check
deno task check
deno task lint
deno test -A
deno task build
```

`deno task build` runs lint and tests before compiling `./bin/STC`.

For the Raylib demo:

```sh
STC check raylib/main.tc
STC build raylib/main.tc --build-dir raylib/build
```

## Release status

Current version: **TypeC 0.1.2**

Latest completed documented phase: **Phase 300 — TypeC 0.1 Release Candidate**.

There is currently no documented Phase 301 in `TYPEC_PHASES.md`.
