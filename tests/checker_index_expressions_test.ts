import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkIndexExpression } from "checker/index_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks index expressions", () => {
  const result = checkIndexExpression(
    indexExpr(identifier("items"), integer("0")),
    "i32[2]",
    resolveUsize,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("checks slice index expressions", () => {
  const result = checkIndexExpression(
    indexExpr(identifier("items"), integer("0")),
    "Slice<i32>",
    resolveUsize,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("reports invalid index expressions", () => {
  const nonArray = checkIndexExpression(
    indexExpr(identifier("value"), integer("0")),
    "i32",
    resolveUsize,
  );
  const badIndex = checkIndexExpression(
    indexExpr(identifier("items"), integer("0")),
    "i32[2]",
    resolveF64,
  );

  assertText(nonArray.diagnostics[0]?.message ?? "", "Cannot index non-array type 'i32'");
  assertText(badIndex.diagnostics[0]?.message ?? "", "Array index type 'f64' is not an integer");
});

function resolveUsize(_expr: Expression): TypeName {
  return "usize";
}

function resolveF64(_expr: Expression): TypeName {
  return "f64";
}

function indexExpr(
  operand: Expression,
  index: Expression,
): Extract<Expression, { kind: "IndexExpr" }> {
  return { kind: "IndexExpr", operand, index, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
