import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkRecordLiteralExpression } from "checker/record_literal_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks record literal expressions", () => {
  const aliases = new Map<Str, TypeRef>([["Vec2", record([field("x", named("i32"))])]]);
  const result = checkRecordLiteralExpression(
    literalWith([literalField("x")]),
    "Vec2",
    aliases,
    resolveExpected,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "Vec2");
});

Deno.test("reports invalid record literal expressions", () => {
  const aliases = new Map<Str, TypeRef>();
  const result = checkRecordLiteralExpression(
    literalWith([literalField("x")]),
    "i32",
    aliases,
    resolveExpected,
  );

  assertText(
    result.diagnostics[0]?.message ?? "",
    "Record literal is not assignable to non-record type 'i32'",
  );
  assertText(result.type, "<error>");
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

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
): Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize] {
  return { name, expression: { kind: "IntegerLiteral", value: 1n, text: "1", span }, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
