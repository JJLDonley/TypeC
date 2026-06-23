import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkExpectedExpression } from "checker/expected_expressions.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks expected primitive expressions", () => {
  const intResult = checkExpectedExpression(integer("1"), "i64", aliases(), resolveExpected);
  const cIntResult = checkExpectedExpression(integer("1"), "c_int", aliases(), resolveExpected);
  const floatResult = checkExpectedExpression(float("1.0"), "f32", aliases(), resolveExpected);
  const stringResult = checkExpectedExpression(
    stringLiteral("hi"),
    "u8*",
    aliases(),
    resolveExpected,
  );

  assertHandled(intResult.handled);
  assertText(intResult.type, "i64");
  assertHandled(cIntResult.handled);
  assertText(cIntResult.type, "c_int");
  assertHandled(floatResult.handled);
  assertText(floatResult.type, "f32");
  assertHandled(stringResult.handled);
  assertText(stringResult.type, "u8[3]");
});

Deno.test("checks expected aggregate expressions", () => {
  const map = aliases([["Vec2", record([field("x", named("i32"))])]]);
  const recordResult = checkExpectedExpression(
    recordLiteral([recordField("x")]),
    "Vec2",
    map,
    resolveExpected,
  );
  const arrayResult = checkExpectedExpression(
    arrayLiteral([integer("1")]),
    "i32[]",
    aliases(),
    resolveExpected,
  );

  assertText(recordResult.type, "Vec2");
  assertLen(recordResult.diagnostics.length, 0);
  assertText(arrayResult.type, "i32[1]");
  assertLen(arrayResult.diagnostics.length, 0);
});

Deno.test("skips non-special expected expressions", () => {
  const result = checkExpectedExpression(identifier("value"), "i32", aliases(), resolveExpected);

  assertSame(result.handled, false);
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function aliases(entries: [Str, TypeRef][] = []): Map<Str, TypeRef> {
  return new Map<Str, TypeRef>(entries);
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function float(text: Str): Expression {
  return { kind: "FloatLiteral", value: Number(text), text, span };
}

function stringLiteral(text: Str): Expression {
  return { kind: "StringLiteral", text, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function recordLiteral(
  fields: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"],
): Expression {
  return { kind: "RecordLiteralExpr", fields, span };
}

function recordField(
  name: Str,
): Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize] {
  return { name, expression: integer("1"), span };
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

function assertHandled(value: b8): void {
  if (!value) throw new Error("Expected handled expression");
}

function assertSame<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
