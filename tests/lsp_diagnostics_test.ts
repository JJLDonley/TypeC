import { syntaxDiagnostics } from "lsp/diagnostics.ts";

Deno.test("LSP syntax diagnostics accepts valid source", () => {
  const diagnostics = syntaxDiagnostics("function main(): i32 { return 0; }");
  if (diagnostics.length !== 0) throw new Error("Expected no diagnostics");
});

Deno.test("LSP syntax diagnostics reports parser errors", () => {
  const diagnostics = syntaxDiagnostics("function main(: i32 { return 0; }");
  if (diagnostics.length === 0) throw new Error("Expected diagnostics");
  if (diagnostics[0]!.source !== "typec") throw new Error("Expected TypeC diagnostic source");
  if (diagnostics[0]!.range.start.line !== 0) throw new Error("Expected zero-based range");
});
