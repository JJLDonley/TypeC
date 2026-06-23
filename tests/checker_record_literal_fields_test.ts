import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkRecordLiteralFields } from "checker/record_literal_fields.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks record literal fields", () => {
  const diagnostics = checkRecordLiteralFields(
    recordLiteral([["x", integer("1")]]),
    record([["x", named("i32")]]),
    "Pair",
    resolveExpected,
  );

  assertLen(diagnostics.length, 0);
});

Deno.test("reports record literal field errors", () => {
  const diagnostics = checkRecordLiteralFields(
    recordLiteral([["x", integer("1")], ["x", integer("2")], ["z", integer("3")]]),
    record([["x", named("u8")], ["y", named("i32")]]),
    "Pair",
    resolveActual,
  );

  assertSame(diagnostics.some((diagnostic) => diagnostic.message === "Duplicate field 'x'"), true);
  assertSame(
    diagnostics.some((diagnostic) => diagnostic.message === "Unknown field 'z' on type 'Pair'"),
    true,
  );
  assertSame(
    diagnostics.some((diagnostic) => diagnostic.message === "Missing field 'y' on type 'Pair'"),
    true,
  );
  assertSame(
    diagnostics.some((diagnostic) =>
      diagnostic.message === "Field 'x' type 'i32' is not assignable to 'u8'"
    ),
    true,
  );
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function resolveActual(_expr: Expression, _expected: TypeName): TypeName {
  return "i32";
}

function recordLiteral(
  fields: [Str, Expression][],
): Extract<Expression, { kind: "RecordLiteralExpr" }> {
  return {
    kind: "RecordLiteralExpr",
    fields: fields.map(([name, expression]) => ({ name, expression, span })),
    span,
  };
}

function record(fields: [Str, TypeRef][]): RecordTypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span })),
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
