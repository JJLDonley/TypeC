import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { type BinaryOperandTypes, checkBinaryOperation } from "checker/binary_operations.ts";

type b8 = boolean;

type BinaryExpr = Extract<Expression, { kind: "BinaryExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type TypePredicate = (type: TypeName) => b8;

export interface BinaryExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkBinaryExpression(
  expr: BinaryExpr,
  resolveType: TypeResolver,
  resolveExpectedType: ExpectedTypeResolver,
  isEnumType: TypePredicate = () => false,
): BinaryExpressionCheck {
  const operands = binaryOperandTypes(expr, resolveType, resolveExpectedType);
  return checkBinaryOperation(expr, operands, isEnumType);
}

function binaryOperandTypes(
  expr: BinaryExpr,
  resolveType: TypeResolver,
  resolveExpectedType: ExpectedTypeResolver,
): BinaryOperandTypes {
  const left = resolveType(expr.left);
  const right = resolveExpectedType(expr.right, left);
  if (left === right) return { left, right };
  if (isHintableLiteral(expr.left)) return { left: resolveExpectedType(expr.left, right), right };
  return { left, right };
}

function isHintableLiteral(
  expr: Expression,
): expr is Extract<Expression, { kind: "IntegerLiteral" | "FloatLiteral" }> {
  return expr.kind === "IntegerLiteral" || expr.kind === "FloatLiteral";
}
