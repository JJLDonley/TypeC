# TypeC VSCode Extension

VSCode client wrapper for the TypeC language server.

## Use from this repository

```bash
cd vscode-extension
npm install
npm run compile
```

Then open this folder in VSCode and run the extension host.

The extension starts:

```bash
../bin/STC lsp
```

If that binary is not present, it falls back to `STC` from `PATH`.

## Setting

```json
{
  "typec.compilerPath": "/absolute/path/to/STC",
  "typec.buildDir": "out"
}
```

## Commands

- `TypeC: Check Current File`
- `TypeC: Build Current File`
- `TypeC: Run Current File`
- `TypeC: Clean Current File`
- `TypeC: Watch Current File`
- `TypeC: Format Current File`
- `TypeC: Check Current File Formatting`
- `TypeC: Parse Current File`
- `TypeC: Emit C for Current File`
- `TypeC: Emit AST for Current File`
- `TypeC: Restart Language Server`
- `TypeC: Show Language Server Output`
- `TypeC: Show Compiler Version`
- `TypeC: Show Compiler Help`
- `TypeC: Configure Compiler Path`
- `TypeC: Configure Build Directory`
- `TypeC: Configure Language Server Trace`
- `TypeC: Configure Settings`

Current-file commands are also available from the editor and Explorer context menus for TypeC files.
The build current-file command is marked as a VSCode build task. A matching active-file build task
is available through VSCode task commands. Current-file task diagnostics are exposed through the
TypeC VSCode problem matcher.

The extension only provides the VSCode client wrapper and command bridge. Language behavior comes
from the TypeC LSP.
