import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkBinaryExpression } from "checker/binary_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks binary expressions", () => {
  const result = checkBinaryExpression(
    binary(identifier("x"), "+", identifier("y")),
    resolveI32,
    resolveExpected,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("hints left literals from right operand", () => {
  const result = checkBinaryExpression(
    binary(integer("1"), "+", identifier("wide")),
    resolveWideRight,
    resolveExpected,
  );

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i64");
});

Deno.test("reports binary expression errors", () => {
  const result = checkBinaryExpression(
    binary(identifier("a"), "+", identifier("b")),
    resolveMixed,
    resolveExpected,
  );

  assertText(result.diagnostics[0]?.message ?? "", "Cannot apply '+' to 'i32' and 'f64'");
  assertText(result.type, "<error>");
});

function resolveI32(_expr: Expression): TypeName {
  return "i32";
}

function resolveMixed(expr: Expression): TypeName {
  if (expr.kind === "IdentifierExpr" && expr.name === "b") return "f64";
  return "i32";
}

function resolveWideRight(expr: Expression): TypeName {
  if (expr.kind === "IdentifierExpr" && expr.name === "wide") return "i64";
  return "i32";
}

function resolveExpected(expr: Expression, expected: TypeName): TypeName {
  if (expr.kind === "IntegerLiteral" && isIntegerTypeName(expected)) return expected;
  if (expr.kind === "IdentifierExpr" && expr.name === "wide") return "i64";
  return resolveMixed(expr);
}

function isIntegerTypeName(type: TypeName): type is TypeName {
  return type === "i32" || type === "i64";
}

function binary(
  left: Expression,
  operator: Str,
  right: Expression,
): Extract<Expression, { kind: "BinaryExpr" }> {
  return { kind: "BinaryExpr", left, operator, right, span };
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
