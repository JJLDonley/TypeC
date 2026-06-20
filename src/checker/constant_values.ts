import type { ConstDecl, Expression } from "core/ast.ts";

type Str = string;
type IntValue = bigint;

export function evaluateIntegerConstant(
  expr: Expression,
  constants: Map<Str, ConstDecl>,
): IntValue | null {
  switch (expr.kind) {
    case "IntegerLiteral":
      return expr.value;
    case "IdentifierExpr":
      return evaluateReferencedIntegerConstant(expr.name, constants);
    case "FieldAccessExpr":
      return evaluateQualifiedIntegerConstant(expr, constants);
    case "UnaryExpr":
      return evaluateUnaryIntegerConstant(expr, constants);
    case "BinaryExpr":
      return evaluateBinaryIntegerConstant(expr, constants);
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "CallExpr":
    case "PostfixPointerExpr":
    case "RecordLiteralExpr":
    case "ArrayLiteralExpr":
    case "IndexExpr":
      return null;
  }
}

function evaluateReferencedIntegerConstant(
  name: Str,
  constants: Map<Str, ConstDecl>,
): IntValue | null {
  const constant = constants.get(name) ?? null;
  if (constant === null) return null;
  return evaluateIntegerConstant(constant.initializer, constants);
}

function evaluateQualifiedIntegerConstant(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  constants: Map<Str, ConstDecl>,
): IntValue | null {
  if (expr.operand.kind !== "IdentifierExpr") return null;
  return evaluateReferencedIntegerConstant(`${expr.operand.name}.${expr.field}`, constants);
}

function evaluateUnaryIntegerConstant(
  expr: Extract<Expression, { kind: "UnaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): IntValue | null {
  const value = evaluateIntegerConstant(expr.operand, constants);
  if (value === null) return null;
  if (expr.operator === "+") return value;
  return -value;
}

function evaluateBinaryIntegerConstant(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): IntValue | null {
  const left = evaluateIntegerConstant(expr.left, constants);
  const right = evaluateIntegerConstant(expr.right, constants);
  if (left === null || right === null) return null;
  return applyIntegerOperator(left, right, expr.operator);
}

function applyIntegerOperator(left: IntValue, right: IntValue, operator: Str): IntValue | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0n) return null;
      return left / right;
    case "%":
      if (right === 0n) return null;
      return left % right;
    default:
      return null;
  }
}
