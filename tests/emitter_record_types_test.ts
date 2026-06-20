import type { FunctionDecl, RecordTypeRef, TypeAliasDecl } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { expectedRecordType } from "emitter/record_types.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("finds expected records by TypeC name", () => {
  const record = recordType();
  const found = expectedRecordType("Pixel", context([alias("Pixel", null, record)]));

  assertSame(found === record, true);
});

Deno.test("finds expected records by emitted C name", () => {
  const record = recordType();
  const found = expectedRecordType("Pixel", context([alias("Header.Pixel", "Pixel", record)]));

  assertSame(found === record, true);
});

Deno.test("ignores non-record aliases", () => {
  const found = expectedRecordType("Count", context([scalarAlias("Count", null)]));

  assertSame(found === null, true);
});

function alias(name: Str, cName: Str | null, type: RecordTypeRef): TypeAliasDecl {
  return { kind: "TypeAliasDecl", exported: false, name, cName, type, span };
}

function scalarAlias(name: Str, cName: Str | null): TypeAliasDecl {
  return { kind: "TypeAliasDecl", exported: false, name, cName, type: named("i32"), span };
}

function recordType(): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: [{ name: "x", type: named("i32"), span }], span };
}

function named(name: Str): TypeAliasDecl["type"] {
  return { kind: "NamedTypeRef", name, span };
}

function context(
  typeAliases: TypeAliasDecl[],
): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return {
    typeAliases: new Map<Str, TypeAliasDecl>(
      typeAliases.map((typeAlias) => [typeAlias.name, typeAlias]),
    ),
    functions: new Map<Str, FunctionDecl>(),
  };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
