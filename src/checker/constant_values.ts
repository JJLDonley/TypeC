import type { ConstDecl, Expression } from "core/ast.ts";

type Str = string;
type IntValue = bigint;
type f64 = number;

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

export function evaluateFloatConstant(
  expr: Expression,
  constants: Map<Str, ConstDecl>,
): f64 | null {
  switch (expr.kind) {
    case "FloatLiteral":
      return expr.value;
    case "IntegerLiteral":
      return Number(expr.value);
    case "IdentifierExpr":
      return evaluateReferencedFloatConstant(expr.name, constants);
    case "FieldAccessExpr":
      return evaluateQualifiedFloatConstant(expr, constants);
    case "UnaryExpr":
      return evaluateUnaryFloatConstant(expr, constants);
    case "BinaryExpr":
      return evaluateBinaryFloatConstant(expr, constants);
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

function evaluateReferencedFloatConstant(
  name: Str,
  constants: Map<Str, ConstDecl>,
): f64 | null {
  const constant = constants.get(name) ?? null;
  if (constant === null) return null;
  return evaluateFloatConstant(constant.initializer, constants);
}

function evaluateQualifiedFloatConstant(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  constants: Map<Str, ConstDecl>,
): f64 | null {
  if (expr.operand.kind !== "IdentifierExpr") return null;
  return evaluateReferencedFloatConstant(`${expr.operand.name}.${expr.field}`, constants);
}

function evaluateUnaryFloatConstant(
  expr: Extract<Expression, { kind: "UnaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): f64 | null {
  const value = evaluateFloatConstant(expr.operand, constants);
  if (value === null) return null;
  if (expr.operator === "+") return value;
  return -value;
}

function evaluateBinaryFloatConstant(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): f64 | null {
  const left = evaluateFloatConstant(expr.left, constants);
  const right = evaluateFloatConstant(expr.right, constants);
  if (left === null || right === null) return null;
  return applyFloatOperator(left, right, expr.operator);
}

function applyFloatOperator(left: f64, right: f64, operator: Str): f64 | null {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "%":
      return left % right;
    default:
      return null;
  }
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
