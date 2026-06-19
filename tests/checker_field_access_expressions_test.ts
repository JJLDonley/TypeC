import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkFieldAccessExpression } from "checker/field_access_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks field access expressions", () => {
  const aliases = new Map<Str, TypeRef>([["Vec2", record([field("x", named("i32"))])]]);
  const result = checkFieldAccessExpression(fieldAccess(identifier("point"), "x"), "Vec2", aliases);

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("reports invalid field access expressions", () => {
  const aliases = new Map<Str, TypeRef>();
  const result = checkFieldAccessExpression(fieldAccess(identifier("value"), "x"), "i32", aliases);

  assertText(result.diagnostics[0]?.message ?? "", "Cannot access field 'x' on non-record type 'i32'");
  assertText(result.type, "<error>");
});

function fieldAccess(operand: Expression, field: Str): Extract<Expression, { kind: "FieldAccessExpr" }> {
  return { kind: "FieldAccessExpr", operand, field, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
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

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
