import type { ConstDecl, Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkConstantValue(
  constant: ConstDecl,
  availableConstants: Set<Str>,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  return [
    ...checkConstantExpression(constant.initializer, availableConstants),
    ...checkConstantAssignable(constant, resolveExpectedType),
  ];
}

function checkConstantAssignable(
  constant: ConstDecl,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  resolveExpectedType(constant.initializer, typeName(constant.type));
  return [];
}

function checkConstantExpression(expr: Expression, availableConstants: Set<Str>): Diagnostic[] {
  if (isConstantExpression(expr, availableConstants)) return [];
  return [{ message: `Expression is not valid in a compile-time constant`, span: expr.span }];
}

function isConstantExpression(expr: Expression, availableConstants: Set<Str>): b8 {
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
      return isConstantExpression(expr.left, availableConstants) &&
        isConstantExpression(expr.right, availableConstants);
    case "RecordLiteralExpr":
      return expr.fields.every((field) =>
        isConstantExpression(field.expression, availableConstants)
      );
    case "ArrayLiteralExpr":
      return expr.elements.every((element) => isConstantExpression(element, availableConstants));
    case "CallExpr":
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
    case "IndexExpr":
      return false;
  }
}
