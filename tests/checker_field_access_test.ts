import type { SourceSpan } from "core/diagnostics.ts";
import type { RecordTypeRef, TypeRef } from "core/ast.ts";
import { checkFieldAccess } from "checker/field_access.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks valid field access", () => {
  const result = checkFieldAccess(record([field("x", named("i32"))]), "Vec2", "x", span);

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports invalid field access", () => {
  const nonRecord = checkFieldAccess(null, "i32", "x", span);
  const unknownField = checkFieldAccess(record([field("x", named("i32"))]), "Vec2", "y", span);

  assertText(nonRecord.type, "<error>");
  assertText(
    nonRecord.diagnostics[0]?.message ?? "",
    "Cannot access field 'x' on non-record type 'i32'",
  );
  assertText(unknownField.type, "<error>");
  assertText(unknownField.diagnostics[0]?.message ?? "", "Unknown field 'y' on type 'Vec2'");
});

function record(fields: RecordTypeRef["fields"]): RecordTypeRef {
  return { kind: "RecordTypeRef", fields, span };
}

function field(name: Str, type: TypeRef): RecordTypeRef["fields"][usize] {
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
