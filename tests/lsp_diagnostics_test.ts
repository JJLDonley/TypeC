import { check } from "checker";
import { TypeCError } from "core/diagnostics.ts";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { resolve } from "core/resolver.ts";
import { semanticDiagnostics, syntaxDiagnostics } from "lsp/diagnostics.ts";
import { parse } from "parser";

type Str = string;

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

Deno.test("LSP semantic diagnostics match compiler diagnostics", () => {
  const source = "function main(): i32 { return missing; }";
  const lsp = semanticDiagnostics(source);
  const compiler = compilerDiagnosticMessages(source);

  if (lsp.length !== compiler.length) throw new Error("Expected matching diagnostic count");
  assertText(lsp[0]?.code ?? "", compiler[0]?.code ?? "");
  assertText(lsp[0]?.message ?? "", compiler[0]?.message ?? "");
});

Deno.test("LSP reports diagnostics for compiler-rejected documents", () => {
  const diagnostics = semanticDiagnostics("function main(): i32 { return true; }");
  if (diagnostics.length === 0) throw new Error("Expected rejected document diagnostics");
});

Deno.test("LSP semantic diagnostics load project dependencies for file URIs", async () => {
  const dir = await Deno.makeTempDir();
  const mainPath = `${dir}/main.tc`;
  await Deno.writeTextFile(
    `${dir}/project.json`,
    JSON.stringify({ dependencies: { mathlib: "./math.tc" } }),
  );
  await Deno.writeTextFile(
    `${dir}/math.tc`,
    "export function inc(value: i32): i32 { return value + 1; }",
  );
  const source = 'import * as M from "mathlib"; function main(): i32 { return M.inc(1); }';
  await Deno.writeTextFile(mainPath, source);

  const diagnostics = semanticDiagnostics(source, pathToFileUri(mainPath));
  if (diagnostics.length !== 0) throw new Error("Expected project-aware LSP diagnostics to pass");
});

function pathToFileUri(path: Str): Str {
  return `file://${path}`;
}

function compilerDiagnosticMessages(source: Str): { code: Str; message: Str }[] {
  try {
    check(resolve(instantiateGenerics(parse(lex(source)))));
  } catch (error) {
    if (error instanceof TypeCError) {
      return error.diagnostics.map((diagnostic) => ({
        code: diagnostic.code ?? "",
        message: diagnostic.message,
      }));
    }
    throw error;
  }
  return [];
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
