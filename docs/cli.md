# TypeC CLI 0.1

The compiler executable is `STC`.

## Commands

```txt
STC check <file.tc>
STC build <file.tc> [--build-dir <dir>]
STC run <file.tc> [--build-dir <dir>]
STC emit-c <file.tc>
STC emit-externs <header.h> [-o <file.tc>] [-- <clang flags...>]
STC fmt <paths...>
STC clean <file.tc> [--build-dir <dir>]
STC --version
```

Additional developer commands remain available:

```txt
STC parse <file.tc>
STC emit-ast <file.tc>
STC fmt-check <paths...>
STC watch <file.tc> [--build-dir <dir>]
STC lsp
STC help
```

## Behavior

- `check` validates syntax, imports, and static semantics without writing generated artifacts.
- `build` emits C into the build directory and invokes the configured native C compiler.
- `run` performs `build`, then launches the generated executable.
- `emit-c` prints generated C to standard output and writes no artifacts.
- `emit-externs` converts a C header into TypeC extern declarations. Without `-o`, it prints to
  standard output; with `-o`, it writes the selected `.tc` file. Extra clang flags may be passed
  after `--`.
- `fmt` rewrites each listed `.tc` file using the TypeC formatter.
- `clean` removes only the generated `.c` and executable paths for the selected source/build
  directory pair.
- `--version` prints the compiler version.

The default build directory is `build`.

## Exit Codes

- `0`: command succeeded.
- `1`: command failed due invalid CLI arguments, source read failure, syntax/type diagnostics,
  missing `main` for native build/run, native compiler failure, formatter check failure, or
  executable launch failure.

## Failure Guarantees

- Check-only and emit-C modes do not write build artifacts.
- Clean never recursively deletes directories.
- Clean targets only documented generated artifact names derived from the input source basename.
- CLI parse failures print usage and exit with code `1`.
