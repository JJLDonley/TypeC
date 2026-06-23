import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import { checkBinaryOperation } from "checker/binary_operations.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks binary result types", () => {
  assertText(
    checkBinaryOperation(binary("+", integer("1")), { left: "i32", right: "i32" }).type,
    "i32",
  );
  assertText(
    checkBinaryOperation(binary("==", integer("1")), { left: "i32", right: "i32" }).type,
    "bool",
  );
});

Deno.test("reports invalid binary operands", () => {
  const mismatch = checkBinaryOperation(binary("+", integer("1")), { left: "i32", right: "f64" });
  const nonNumeric = checkBinaryOperation(binary("+", integer("1")), {
    left: "bool",
    right: "bool",
  });
  const floatModulo = checkBinaryOperation(binary("%", integer("1")), {
    left: "f64",
    right: "f64",
  });
  const divideByZero = checkBinaryOperation(binary("/", integer("0")), {
    left: "i32",
    right: "i32",
  });

  assertText(mismatch.type, "<error>");
  assertText(mismatch.diagnostics[0]?.message ?? "", "Cannot apply '+' to 'i32' and 'f64'");
  assertText(nonNumeric.diagnostics[0]?.message ?? "", "Operator '+' requires numeric operands");
  assertText(floatModulo.diagnostics[0]?.message ?? "", "Operator '%' requires integer operands");
  assertText(divideByZero.diagnostics[0]?.message ?? "", "Operator '/' cannot divide by zero");
});

function binary(operator: Str, right: Expression): Extract<Expression, { kind: "BinaryExpr" }> {
  return { kind: "BinaryExpr", operator, left: integer("1"), right, span };
}

function integer(text: Str): Extract<Expression, { kind: "IntegerLiteral" }> {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
