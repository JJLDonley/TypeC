import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkCOrdinarySymbols } from "checker/c_ordinary_symbols.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("rejects C function and type alias symbol collisions", () => {
  const diagnostics = checkCOrdinarySymbols([
    fn("Color", null, false),
  ], [alias("Color", null)]);

  assertText(diagnostics[0]?.message ?? "", "Duplicate C ordinary symbol 'Color'");
});

Deno.test("rejects C name collisions across functions and aliases", () => {
  const diagnostics = checkCOrdinarySymbols([
    fn("RL.Color", "Color", true),
  ], [alias("Color", "Color")]);

  assertText(diagnostics[0]?.message ?? "", "Duplicate C ordinary symbol 'Color'");
});

Deno.test("accepts distinct C function and type alias symbols", () => {
  const diagnostics = checkCOrdinarySymbols([
    fn("draw", null, true),
  ], [alias("Color", null)]);

  assertSame(diagnostics.length, 0);
});

function fn(name: Str, cName: Str | null, external: b8): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external,
    name,
    cName,
    params: [],
    returnType: named("void"),
    body: null,
    span,
  };
}

function alias(name: Str, cName: Str | null): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    cName,
    type: { kind: "RecordTypeRef", fields: [], span },
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
