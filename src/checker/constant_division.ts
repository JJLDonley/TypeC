import { evaluateIntegerConstant } from "checker/constant_values.ts";
import type { ConstDecl, Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function checkConstantIntegerDivision(
  expr: Expression,
  constants: Map<Str, ConstDecl>,
): Diagnostic[] {
  if (expr.kind === "BinaryExpr") return checkConstantBinaryIntegerDivision(expr, constants);
  if (expr.kind === "UnaryExpr" || expr.kind === "NonNullAssertExpr") {
    return checkConstantIntegerDivision(expr.operand, constants);
  }
  if (expr.kind === "ConditionalExpr") {
    return checkConstantConditionalIntegerDivision(expr, constants);
  }
  if (expr.kind === "NullishCoalesceExpr") {
    return [
      ...checkConstantIntegerDivision(expr.left, constants),
      ...checkConstantIntegerDivision(expr.fallback, constants),
    ];
  }
  if (expr.kind === "RecordLiteralExpr") {
    return expr.fields.flatMap((field) =>
      checkConstantIntegerDivision(field.expression, constants)
    );
  }
  if (expr.kind === "ArrayLiteralExpr") {
    return expr.elements.flatMap((element) => checkConstantIntegerDivision(element, constants));
  }
  return [];
}

function checkConstantBinaryIntegerDivision(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): Diagnostic[] {
  return [
    ...constantIntegerDivideByZeroDiagnostic(expr, constants),
    ...checkConstantIntegerDivision(expr.left, constants),
    ...checkConstantIntegerDivision(expr.right, constants),
  ];
}

function checkConstantConditionalIntegerDivision(
  expr: Extract<Expression, { kind: "ConditionalExpr" }>,
  constants: Map<Str, ConstDecl>,
): Diagnostic[] {
  return [
    ...checkConstantIntegerDivision(expr.condition, constants),
    ...checkConstantIntegerDivision(expr.whenTrue, constants),
    ...checkConstantIntegerDivision(expr.whenFalse, constants),
  ];
}

function constantIntegerDivideByZeroDiagnostic(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  constants: Map<Str, ConstDecl>,
): Diagnostic[] {
  if (!isIntegerDivisionOperator(expr.operator)) return [];
  const left = evaluateIntegerConstant(expr.left, constants);
  const right = evaluateIntegerConstant(expr.right, constants);
  if (left === null || right !== 0n) return [];
  return [{ message: `Operator '${expr.operator}' cannot divide by zero`, span: expr.span }];
}

function isIntegerDivisionOperator(operator: Str): b8 {
  return operator === "/" || operator === "%";
}
