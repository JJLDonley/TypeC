import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { computeExpressionType, type ExpressionTypeHandlers } from "checker/expression_types.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("computes basic expression types", () => {
  const result = computeExpressionType(integer("1"), handlers());

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("delegates non-basic expression types", () => {
  const result = computeExpressionType(identifier("value"), handlers());

  assertText(result.type, "i64");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports untyped aggregate expressions", () => {
  const record = computeExpressionType(recordLiteral(), handlers());
  const array = computeExpressionType(arrayLiteral(), handlers());

  assertText(record.type, "<error>");
  assertText(
    record.diagnostics[0]?.message ?? "",
    "Record literals require an expected record type",
  );
  assertText(array.type, "<error>");
  assertText(array.diagnostics[0]?.message ?? "", "Array literals require an expected array type");
});

function handlers(): ExpressionTypeHandlers {
  return {
    identifier: resolveI64,
    unary: resolveI64,
    binary: resolveI64,
    conditional: resolveI64,
    nullish: resolveI64,
    call: resolveI64,
    newExpr: resolveI64,
    methodCall: resolveI64,
    pointer: resolveI64,
    nonNullAssert: resolveI64,
    fieldAccess: resolveI64,
    optionalFieldAccess: resolveI64,
    optionalMethodCall: resolveI64,
    optionalIndex: resolveI64,
    index: resolveI64,
  };
}

function resolveI64(): TypeName {
  return "i64";
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function recordLiteral(): Expression {
  return { kind: "RecordLiteralExpr", fields: [], span };
}

function arrayLiteral(): Expression {
  return { kind: "ArrayLiteralExpr", elements: [], span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
