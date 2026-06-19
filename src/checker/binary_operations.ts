import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isComparisonOperator, isIntegerZeroLiteral } from "checker/exprs.ts";
import { isIntegerType, isNumericType } from "checker/types.ts";

type b8 = boolean;

type BinaryExpr = Extract<Expression, { kind: "BinaryExpr" }>;

export interface BinaryOperandTypes {
  left: TypeName;
  right: TypeName;
}

export interface BinaryOperationCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

export function checkBinaryOperation(expr: BinaryExpr, operands: BinaryOperandTypes): BinaryOperationCheck {
  const diagnostics: Diagnostic[] = [];
  if (operands.left !== operands.right) {
    diagnostics.push({ message: `Cannot apply '${expr.operator}' to '${operands.left}' and '${operands.right}'`, span: expr.span });
    return { type: "<error>", diagnostics };
  }
  diagnostics.push(...numericOperandDiagnostics(expr, operands.left));
  if (isComparisonOperator(expr.operator)) return { type: "bool", diagnostics };
  return { type: operands.left, diagnostics };
}

function numericOperandDiagnostics(expr: BinaryExpr, type: TypeName): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isNumericType(type)) diagnostics.push({ message: `Operator '${expr.operator}' requires numeric operands`, span: expr.span });
  if (expr.operator === "%" && !isIntegerType(type)) diagnostics.push({ message: "Operator '%' requires integer operands", span: expr.span });
  if (isIntegerDivideByZero(expr, type)) diagnostics.push({ message: `Operator '${expr.operator}' cannot divide by zero`, span: expr.span });
  return diagnostics;
}

function isIntegerDivideByZero(expr: BinaryExpr, type: TypeName): b8 {
  return (expr.operator === "/" || expr.operator === "%") && isIntegerType(type) && isIntegerZeroLiteral(expr.right);
}
