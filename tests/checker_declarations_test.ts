import type { FunctionDecl, Program, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkDeclarations } from "checker/declarations.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("collects declaration maps", () => {
  const result = checkDeclarations(
    program([typeAlias("Pair", record([["x", named("i32")]]))], [
      fn("use", named("void"), [param("value", named("Pair"))]),
    ]),
  );

  assertSame(result.typeAliases.has("Pair"), true);
  assertSame(result.functions.has("use"), true);
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports invalid declarations", () => {
  const result = checkDeclarations(
    program([typeAlias("Count", named("i32"))], [
      fn("bad", named("Missing"), [param("value", named("void"))]),
    ]),
  );

  assertText(result.diagnostics[0]?.message ?? "", "Type alias 'Count' must name a record type");
  assertText(result.diagnostics[1]?.message ?? "", "Unknown type 'Missing'");
  assertText(result.diagnostics[2]?.message ?? "", "Parameter 'value' cannot have type 'void'");
});

function program(typeAliases: Program["typeAliases"], functions: FunctionDecl[]): ResolvedProgram {
  return { kind: "Program", imports: [], typeAliases, functions, span, symbols: [], scopes: [] };
}

function typeAlias(name: Str, type: TypeRef): Program["typeAliases"][usize] {
  return { kind: "TypeAliasDecl", exported: false, name, type, span };
}

function fn(name: Str, returnType: TypeRef, params: FunctionDecl["params"]): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name,
    params,
    returnType,
    body: null,
    span,
  };
}

function param(name: Str, type: TypeRef): FunctionDecl["params"][usize] {
  return { name, type, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function record(fields: [Str, TypeRef][]): TypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span })),
    span,
  };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
