import { evaluateIntegerConstant } from "checker/constant_values.ts";
import { integerRange } from "checker/types.ts";
import type { ConstDecl, Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkConstantValue(
  constant: ConstDecl,
  availableConstants: Map<Str, ConstDecl>,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  const expectedType = typeName(constant.type);
  return [
    ...checkConstantExpression(constant.initializer, availableConstants),
    ...checkConstantAssignable(constant, resolveExpectedType),
    ...checkConstantIntegerRange(constant.initializer, expectedType, availableConstants),
  ];
}

function checkConstantAssignable(
  constant: ConstDecl,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  resolveExpectedType(constant.initializer, typeName(constant.type));
  return [];
}

function checkConstantIntegerRange(
  expr: Expression,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
): Diagnostic[] {
  const range = integerRange(expectedType);
  if (range === null) return [];
  const value = evaluateIntegerConstant(expr, availableConstants);
  if (value === null || (value >= range.min && value <= range.max)) return [];
  return [{
    message: `Integer constant '${value}' is out of range for '${expectedType}'`,
    span: expr.span,
  }];
}

function checkConstantExpression(
  expr: Expression,
  availableConstants: Map<Str, ConstDecl>,
): Diagnostic[] {
  if (isConstantExpression(expr, availableConstants)) return [];
  return [{ message: `Expression is not valid in a compile-time constant`, span: expr.span }];
}

function isConstantExpression(expr: Expression, availableConstants: Map<Str, ConstDecl>): b8 {
  switch (expr.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
      return true;
    case "IdentifierExpr":
      return availableConstants.has(expr.name);
    case "UnaryExpr":
      return isConstantExpression(expr.operand, availableConstants);
    case "BinaryExpr":
      return isConstantBinaryOperator(expr.operator) &&
        isConstantExpression(expr.left, availableConstants) &&
        isConstantExpression(expr.right, availableConstants);
    case "RecordLiteralExpr":
      return expr.fields.every((field) =>
        isConstantExpression(field.expression, availableConstants)
      );
    case "ArrayLiteralExpr":
      return expr.elements.every((element) => isConstantExpression(element, availableConstants));
    case "CallExpr":
    case "PostfixPointerExpr":
    case "IndexExpr":
      return false;
    case "FieldAccessExpr":
      return isQualifiedConstantExpression(expr, availableConstants);
  }
}

function isConstantBinaryOperator(operator: Str): b8 {
  return operator === "+" || operator === "-" || operator === "*" || operator === "/" ||
    operator === "%";
}

function isQualifiedConstantExpression(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  availableConstants: Map<Str, ConstDecl>,
): b8 {
  if (expr.operand.kind !== "IdentifierExpr") return false;
  return availableConstants.has(`${expr.operand.name}.${expr.field}`);
}
