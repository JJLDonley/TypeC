import type { SourceSpan } from "core/diagnostics.ts";
import type {
  CastBlockStmt,
  CastFunctionDecl,
  CastImportDecl,
  CastStructDecl,
  CastTypeAliasDecl,
  CastTypeRef,
} from "core/cast.ts";
import {
  lowerFunctionDecl,
  lowerImportDecl,
  lowerStructTypeAlias,
  lowerTypeAliasDecl,
} from "lower/declarations.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("lowers import declarations", () => {
  const decl: CastImportDecl = {
    kind: "ImportDecl",
    names: [{ imported: "add", local: "add", span }],
    path: "./math.tc",
    span,
  };
  assertText(lowerImportDecl(decl).path, "./math.tc");
});

Deno.test("lowers type alias declarations", () => {
  const decl: CastTypeAliasDecl = {
    kind: "TypeAliasDecl",
    exported: true,
    name: "Value",
    type: named("i32"),
    span,
  };
  const lowered = lowerTypeAliasDecl(decl);

  assertText(lowered.name, "Value");
  assertSame(lowered.exported, true);
});

Deno.test("lowers struct declarations to record type aliases", () => {
  const decl: CastStructDecl = {
    kind: "StructDecl",
    exported: true,
    name: "Vec2",
    fields: [
      { name: "x", type: named("f32"), span },
      { name: "y", type: named("f32"), span },
    ],
    span,
  };
  const lowered = lowerStructTypeAlias(decl);

  assertText(lowered.name, "Vec2");
  assertText(lowered.cName ?? "", "Vec2");
  assertSame(lowered.exported, true);
  if (lowered.type.kind !== "RecordTypeRef") throw new Error("Expected record type");
  assertText(lowered.type.fields[0]?.name ?? "", "x");
  assertText(lowered.type.fields[1]?.name ?? "", "y");
});

Deno.test("lowers function declarations", () => {
  const decl: CastFunctionDecl = {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name: "main",
    params: [{ name: "x", type: named("i32"), span }],
    returnType: named("i32"),
    body: block(),
    span,
  };
  const lowered = lowerFunctionDecl(decl);

  assertText(lowered.name, "main");
  assertText(lowered.params[0]?.name ?? "", "x");
  assertSame(lowered.body !== null, true);
});

function named(name: Str): CastTypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function block(): CastBlockStmt {
  return { kind: "BlockStmt", statements: [], span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
