import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import {
  checkRecordLiteralFieldName,
  checkRecordLiteralMissingFields,
  checkRecordLiteralTarget,
  findRecordField,
} from "checker/record_literals.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks record literal target and fields", () => {
  const shape = record([field("x", named("i32"))]);
  const literal = literalWith([literalField("x")]);
  const seen = new Set<Str>();

  assertLen(checkRecordLiteralTarget(shape, "Vec2", literal).length, 0);
  assertLen(checkRecordLiteralFieldName(literal.fields[0]! as ReturnType<typeof literalField>, shape, "Vec2", seen).length, 0);
  assertLen(checkRecordLiteralMissingFields(literal, shape, "Vec2", seen).length, 0);
  assertText(findRecordField(shape, "x")?.name ?? "", "x");
});

Deno.test("reports invalid record literal fields", () => {
  const shape = record([field("x", named("i32"))]);
  const literal = literalWith([literalField("y")]);
  const seen = new Set<Str>(["y"]);

  const targetDiagnostics = checkRecordLiteralTarget(null, "i32", literal);
  const fieldDiagnostics = checkRecordLiteralFieldName(literal.fields[0]! as ReturnType<typeof literalField>, shape, "Vec2", seen);
  const missingDiagnostics = checkRecordLiteralMissingFields(literal, shape, "Vec2", seen);

  assertText(
    targetDiagnostics[0]?.message ?? "",
    "Record literal is not assignable to non-record type 'i32'",
  );
  assertText(fieldDiagnostics[0]?.message ?? "", "Duplicate field 'y'");
  assertText(fieldDiagnostics[1]?.message ?? "", "Unknown field 'y' on type 'Vec2'");
  assertText(missingDiagnostics[0]?.message ?? "", "Missing field 'x' on type 'Vec2'");
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

function literalWith(
  fields: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"],
): Extract<Expression, { kind: "RecordLiteralExpr" }> {
  return { kind: "RecordLiteralExpr", fields, span };
}

function literalField(
  name: Str,
): Extract<Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize], { kind?: "Field" }> {
  return { name, expression: { kind: "IntegerLiteral", value: 1n, text: "1", span }, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
