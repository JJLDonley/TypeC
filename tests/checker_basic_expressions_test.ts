import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkBasicExpression } from "checker/basic_expressions.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks basic expression types", () => {
  const integerResult = checkBasicExpression(integer("1"));
  const floatResult = checkBasicExpression(float("1.0"));
  const boolResult = checkBasicExpression(boolLiteral(true));

  assertSame(integerResult.handled, true);
  assertText(integerResult.type, "i32");
  assertSame(floatResult.handled, true);
  assertText(floatResult.type, "f64");
  assertSame(boolResult.handled, true);
  assertText(boolResult.type, "bool");
});

Deno.test("reports untyped string literal expressions", () => {
  const result = checkBasicExpression(stringLiteral("hi"));

  assertSame(result.handled, true);
  assertText(result.type, "u8[3]");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "String literals require an expected C string type",
  );
});

Deno.test("skips non-basic expressions", () => {
  const result = checkBasicExpression(identifier("value"));

  assertSame(result.handled, false);
  assertLen(result.diagnostics.length, 0);
});

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function float(text: Str): Expression {
  return { kind: "FloatLiteral", value: Number(text), text, span };
}

function boolLiteral(value: b8): Expression {
  return { kind: "BoolLiteral", value, text: value ? "true" : "false", span };
}

function stringLiteral(text: Str): Expression {
  return { kind: "StringLiteral", text, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
