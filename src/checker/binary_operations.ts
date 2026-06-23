import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import {
  isBitwiseBinaryOperator,
  isComparisonOperator,
  isIntegerZeroLiteral,
  isShiftOperator,
} from "checker/exprs.ts";
import {
  integerBitWidth,
  isIntegerType,
  isNumericType,
  isUnsignedIntegerType,
} from "checker/types.ts";

type b8 = boolean;
type usize = number;

type BinaryExpr = Extract<Expression, { kind: "BinaryExpr" }>;
type TypePredicate = (type: TypeName) => b8;

export interface BinaryOperandTypes {
  left: TypeName;
  right: TypeName;
}

export interface BinaryOperationCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

export function checkBinaryOperation(
  expr: BinaryExpr,
  operands: BinaryOperandTypes,
  isEnumType: TypePredicate = () => false,
): BinaryOperationCheck {
  const diagnostics: Diagnostic[] = [];
  if (isEnumEquality(expr, operands, isEnumType)) return { type: "bool", diagnostics };
  if (isShiftOperator(expr.operator)) return checkShiftOperation(expr, operands);
  if (operands.left !== operands.right) {
    diagnostics.push({
      message: `Cannot apply '${expr.operator}' to '${operands.left}' and '${operands.right}'`,
      span: expr.span,
    });
    return { type: "<error>", diagnostics };
  }
  diagnostics.push(...binaryOperandDiagnostics(expr, operands.left));
  if (isComparisonOperator(expr.operator)) return { type: "bool", diagnostics };
  return { type: operands.left, diagnostics };
}

function isEnumEquality(
  expr: BinaryExpr,
  operands: BinaryOperandTypes,
  isEnumType: TypePredicate,
): b8 {
  return operands.left === operands.right && isEnumType(operands.left) &&
    (expr.operator === "==" || expr.operator === "!=");
}

function checkShiftOperation(
  expr: BinaryExpr,
  operands: BinaryOperandTypes,
): BinaryOperationCheck {
  const diagnostics: Diagnostic[] = [];
  if (!isIntegerType(operands.left)) {
    diagnostics.push({
      message: `Operator '${expr.operator}' requires an integer left operand`,
      span: expr.span,
    });
  }
  if (!isUnsignedIntegerType(operands.right)) {
    diagnostics.push({
      message: `Operator '${expr.operator}' requires an unsigned integer shift count`,
      span: expr.span,
    });
  }
  if (expr.operator === ">>>" && !isUnsignedIntegerType(operands.left)) {
    diagnostics.push({
      message: "Operator '>>>' requires an unsigned integer left operand",
      span: expr.span,
    });
  }
  diagnostics.push(...shiftCountDiagnostics(expr, operands.left));
  return { type: diagnostics.length === 0 ? operands.left : "<error>", diagnostics };
}

function shiftCountDiagnostics(expr: BinaryExpr, leftType: TypeName): Diagnostic[] {
  if (expr.right.kind !== "IntegerLiteral") return [];
  const width = integerBitWidth(leftType);
  if (width === null) return [];
  if (expr.right.value < BigInt(width)) return [];
  return [{ message: `Shift count must be less than ${width}`, span: expr.right.span }];
}

function binaryOperandDiagnostics(expr: BinaryExpr, type: TypeName): Diagnostic[] {
  if (isBitwiseBinaryOperator(expr.operator)) return bitwiseOperandDiagnostics(expr, type);
  return numericOperandDiagnostics(expr, type);
}

function bitwiseOperandDiagnostics(expr: BinaryExpr, type: TypeName): Diagnostic[] {
  if (isIntegerType(type)) return [];
  return [{ message: `Operator '${expr.operator}' requires integer operands`, span: expr.span }];
}

function numericOperandDiagnostics(expr: BinaryExpr, type: TypeName): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isNumericType(type)) {
    diagnostics.push({
      message: `Operator '${expr.operator}' requires numeric operands`,
      span: expr.span,
    });
  }
  if (expr.operator === "%" && !isIntegerType(type)) {
    diagnostics.push({ message: "Operator '%' requires integer operands", span: expr.span });
  }
  if (isIntegerDivideByZero(expr, type)) {
    diagnostics.push({
      message: `Operator '${expr.operator}' cannot divide by zero`,
      span: expr.span,
    });
  }
  return diagnostics;
}

function isIntegerDivideByZero(expr: BinaryExpr, type: TypeName): b8 {
  return (expr.operator === "/" || expr.operator === "%") && isIntegerType(type) &&
    isIntegerZeroLiteral(expr.right);
}
