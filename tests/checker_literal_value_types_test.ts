import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { checkTypeAliasLiteralValueTypes } from "checker/literal_value_types.ts";

export type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("allows literal-only type aliases", () => {
  const diagnostics = checkTypeAliasLiteralValueTypes(alias("One", literal("1")), new Map());

  assertLen(diagnostics.length, 0);
});

Deno.test("rejects literal runtime fields in type aliases", () => {
  const diagnostics = checkTypeAliasLiteralValueTypes(
    alias("Record", record([["x", literal("1")]])),
    new Map(),
  );

  assertText(diagnostics[0]?.message ?? "", "Literal type cannot be used as a value type");
});

Deno.test("rejects literal-only aliases in runtime type aliases", () => {
  const diagnostics = checkTypeAliasLiteralValueTypes(
    alias("Record", record([["x", named("One")]])),
    new Map([["One", literal("1")]]),
  );

  assertText(
    diagnostics[0]?.message ?? "",
    "Literal-only type alias 'One' cannot be used as a value type",
  );
});

function alias(name: Str, type: TypeRef): TypeAliasDecl {
  return { kind: "TypeAliasDecl", name, type, exported: false, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function literal(value: Str): TypeRef {
  return { kind: "LiteralTypeRef", value, text: value, span };
}

function record(fields: [Str, TypeRef][]): TypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span })),
    span,
  };
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
