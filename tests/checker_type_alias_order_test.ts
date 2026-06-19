import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkTypeAliasOrder } from "checker/type_alias_order.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts backward type alias dependencies", () => {
  assertLen(checkTypeAliasOrder([alias("Point", []), alias("Line", [field("start", named("Point"))])]).length, 0);
});

Deno.test("reports forward type alias dependencies", () => {
  const diagnostics = checkTypeAliasOrder([alias("Line", [field("start", named("Point"))]), alias("Point", [])]);

  assertText(diagnostics[0]?.message ?? "", "Type alias 'Line' cannot depend on 'Point' before it is declared");
});

function alias(name: Str, fields: Extract<TypeRef, { kind: "RecordTypeRef" }>["fields"]): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    type: { kind: "RecordTypeRef", fields, span },
    span,
  };
}

function field(name: Str, type: TypeRef): Extract<TypeRef, { kind: "RecordTypeRef" }>["fields"][0] {
  return { name, type, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
