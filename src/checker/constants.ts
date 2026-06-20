import type { ConstDecl, Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type b8 = boolean;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkConstantValue(
  constant: ConstDecl,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  return [
    ...checkConstantExpression(constant.initializer),
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

function checkConstantExpression(expr: Expression): Diagnostic[] {
  if (isConstantExpression(expr)) return [];
  return [{ message: `Expression is not valid in a compile-time constant`, span: expr.span }];
}

function isConstantExpression(expr: Expression): b8 {
  switch (expr.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "IdentifierExpr":
      return true;
    case "BinaryExpr":
      return isConstantExpression(expr.left) && isConstantExpression(expr.right);
    case "RecordLiteralExpr":
      return expr.fields.every((field) => isConstantExpression(field.expression));
    case "ArrayLiteralExpr":
      return expr.elements.every(isConstantExpression);
    case "CallExpr":
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
    case "IndexExpr":
      return false;
  }
}
