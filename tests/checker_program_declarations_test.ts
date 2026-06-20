import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { collectProgramDeclarations } from "checker/program_declarations.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("collects declarations and C symbol diagnostics", () => {
  const declarations = collectProgramDeclarations(program([
    alias("Color", null),
  ], [
    fn("Lib.Color", "Color"),
    fn("main", null),
  ]));

  assertSame(declarations.functions.size, 2);
  assertSame(declarations.typeAliases.size, 1);
  assertText(declarations.diagnostics[0]?.message ?? "", "Duplicate C ordinary symbol 'Color'");
});

function program(typeAliases: TypeAliasDecl[], functions: FunctionDecl[]): ResolvedProgram {
  return { kind: "Program", imports: [], typeAliases, functions, span, symbols: [], scopes: [] };
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

function fn(name: Str, cName: Str | null): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: true,
    name,
    cName,
    params: [],
    returnType: named("void"),
    body: null,
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
