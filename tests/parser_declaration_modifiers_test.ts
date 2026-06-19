import type { SourceSpan } from "../src/diagnostics.ts";
import type { Token } from "../src/token.ts";
import {
  functionModifierDiagnostics,
  importModifierDiagnostics,
  typeAliasModifierDiagnostics,
} from "../src/parser_declaration_modifiers.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("reports invalid import modifiers", () => {
  const diagnostics = importModifierDiagnostics(token("export"), token("extern"));

  assertText(diagnostics[0]?.message ?? "", "Imports cannot be exported");
  assertText(diagnostics[1]?.message ?? "", "Imports cannot be extern");
});

Deno.test("reports invalid type alias modifiers", () => {
  const diagnostics = typeAliasModifierDiagnostics(token("extern"));

  assertText(diagnostics[0]?.message ?? "", "Type aliases cannot be extern");
});

Deno.test("reports invalid function modifiers", () => {
  const diagnostics = functionModifierDiagnostics(token("export"), token("extern"));

  assertText(diagnostics[0]?.message ?? "", "Extern functions cannot be exported");
});

Deno.test("accepts valid declaration modifiers", () => {
  assertLen(importModifierDiagnostics(null, null).length, 0);
  assertLen(typeAliasModifierDiagnostics(null).length, 0);
  assertLen(functionModifierDiagnostics(token("export"), null).length, 0);
});

function token(text: Str): Token {
  return { kind: "identifier", text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
