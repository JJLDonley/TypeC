# TypeC LSP 0.1

TypeC provides a JSON-RPC Language Server Protocol endpoint through:

```txt
STC lsp
```

## Document Synchronization

The server supports text document open, full-document changes, range changes, and close
notifications. Diagnostics are republished after open and change notifications.

## Diagnostics

Diagnostics use the same parser, resolver, generic instantiation, and checker pipeline as the
compiler for single-document source text. Each diagnostic includes:

- zero-based LSP range
- severity `1`
- source `typec`
- stable TypeC diagnostic code
- diagnostic code URL
- related information when available

A document rejected by the compiler is reported with diagnostics by the LSP. Formatting edits are
not returned for compiler-rejected documents.

## Navigation and Editing Features

Supported 0.1 capabilities:

- hover for declarations and type references
- declaration, definition, and type-definition lookup
- references
- rename with prepare-rename
- linked editing ranges
- call hierarchy
- signature help
- document highlights
- folding ranges
- selection ranges
- document symbols
- workspace symbols for opened documents
- document links
- semantic tokens
- inlay hints for inferred locals and generic calls
- code actions and code lenses
- full-document formatting and range formatting

## Formatting

Formatting uses the TypeC formatter documented in `docs/formatting.md`. The LSP returns
full-document formatting edits only when the current document is accepted by the compiler.

## Limits

The 0.1 LSP operates on opened document text. Cross-file project loading for editor-only unsaved
buffers is limited to opened documents and the current single-document compiler pipeline where
applicable.
