import type {
  ArrayLiteralExpr,
  BinaryExpr,
  BoolLiteral,
  CallExpr,
  ConditionalExpr,
  Expression,
  FieldAccessExpr,
  FloatLiteral,
  IdentifierExpr,
  IndexExpr,
  IntegerLiteral,
  MethodCallExpr,
  NewExpr,
  NonNullAssertExpr,
  NullishCoalesceExpr,
  OptionalFieldAccessExpr,
  OptionalIndexExpr,
  OptionalMethodCallExpr,
  PostfixPointerExpr,
  RecordLiteralExpr,
  StringLiteral,
  UnaryExpr,
} from "core/ast.ts";
import type {
  CastArrayLiteralExpr,
  CastBinaryExpr,
  CastBoolLiteral,
  CastCallExpr,
  CastConditionalExpr,
  CastExpression,
  CastFieldAccessExpr,
  CastFloatLiteral,
  CastIdentifierExpr,
  CastIndexExpr,
  CastIntegerLiteral,
  CastMethodCallExpr,
  CastNewExpr,
  CastNonNullAssertExpr,
  CastNullishCoalesceExpr,
  CastOptionalFieldAccessExpr,
  CastOptionalIndexExpr,
  CastOptionalMethodCallExpr,
  CastPostfixPointerExpr,
  CastRecordLiteralExpr,
  CastStringLiteral,
  CastUnaryExpr,
} from "core/cast.ts";
import { lowerTypeRef } from "lower/types.ts";

export function lowerExpression(expression: CastExpression): Expression {
  switch (expression.kind) {
    case "IntegerLiteral":
      return lowerIntegerLiteral(expression);
    case "FloatLiteral":
      return lowerFloatLiteral(expression);
    case "BoolLiteral":
      return lowerBoolLiteral(expression);
    case "StringLiteral":
      return lowerStringLiteral(expression);
    case "IdentifierExpr":
      return lowerIdentifierExpr(expression);
    case "UnaryExpr":
      return lowerUnaryExpr(expression);
    case "BinaryExpr":
      return lowerBinaryExpr(expression);
    case "ConditionalExpr":
      return lowerConditionalExpr(expression);
    case "NullishCoalesceExpr":
      return lowerNullishCoalesceExpr(expression);
    case "CallExpr":
      return lowerCallExpr(expression);
    case "NewExpr":
      return lowerNewExpr(expression);
    case "MethodCallExpr":
      return lowerMethodCallExpr(expression);
    case "PostfixPointerExpr":
      return lowerPostfixPointerExpr(expression);
    case "NonNullAssertExpr":
      return lowerNonNullAssertExpr(expression);
    case "FieldAccessExpr":
      return lowerFieldAccessExpr(expression);
    case "OptionalFieldAccessExpr":
      return lowerOptionalFieldAccessExpr(expression);
    case "OptionalMethodCallExpr":
      return lowerOptionalMethodCallExpr(expression);
    case "OptionalIndexExpr":
      return lowerOptionalIndexExpr(expression);
    case "RecordLiteralExpr":
      return lowerRecordLiteralExpr(expression);
    case "ArrayLiteralExpr":
      return lowerArrayLiteralExpr(expression);
    case "IndexExpr":
      return lowerIndexExpr(expression);
  }
}

function lowerIntegerLiteral(expression: CastIntegerLiteral): IntegerLiteral {
  return {
    kind: "IntegerLiteral",
    value: expression.value,
    text: expression.text,
    span: expression.span,
  };
}

function lowerFloatLiteral(expression: CastFloatLiteral): FloatLiteral {
  return {
    kind: "FloatLiteral",
    value: expression.value,
    text: expression.text,
    span: expression.span,
  };
}

function lowerBoolLiteral(expression: CastBoolLiteral): BoolLiteral {
  return {
    kind: "BoolLiteral",
    value: expression.value,
    text: expression.text,
    span: expression.span,
  };
}

function lowerStringLiteral(expression: CastStringLiteral): StringLiteral {
  return { kind: "StringLiteral", text: expression.text, span: expression.span };
}

function lowerIdentifierExpr(expression: CastIdentifierExpr): IdentifierExpr {
  return { kind: "IdentifierExpr", name: expression.name, span: expression.span };
}

function lowerUnaryExpr(expression: CastUnaryExpr): UnaryExpr {
  return {
    kind: "UnaryExpr",
    operator: expression.operator,
    operand: lowerExpression(expression.operand),
    span: expression.span,
  };
}

function lowerBinaryExpr(expression: CastBinaryExpr): BinaryExpr {
  return {
    kind: "BinaryExpr",
    operator: expression.operator,
    left: lowerExpression(expression.left),
    right: lowerExpression(expression.right),
    span: expression.span,
  };
}

function lowerConditionalExpr(expression: CastConditionalExpr): ConditionalExpr {
  return {
    kind: "ConditionalExpr",
    condition: lowerExpression(expression.condition),
    whenTrue: lowerExpression(expression.whenTrue),
    whenFalse: lowerExpression(expression.whenFalse),
    span: expression.span,
  };
}

function lowerNullishCoalesceExpr(expression: CastNullishCoalesceExpr): NullishCoalesceExpr {
  return {
    kind: "NullishCoalesceExpr",
    operator: expression.operator,
    left: lowerExpression(expression.left),
    fallback: lowerExpression(expression.fallback),
    span: expression.span,
  };
}

function lowerCallExpr(expression: CastCallExpr): CallExpr {
  return {
    kind: "CallExpr",
    callee: expression.callee,
    typeArgs: expression.typeArgs?.map((typeArg) => lowerTypeRef(typeArg)),
    args: expression.args.map(lowerExpression),
    span: expression.span,
  };
}

function lowerNewExpr(expression: CastNewExpr): NewExpr {
  return {
    kind: "NewExpr",
    className: expression.className,
    typeArgs: expression.typeArgs?.map((typeArg) => lowerTypeRef(typeArg)),
    args: expression.args.map(lowerExpression),
    span: expression.span,
  };
}

function lowerMethodCallExpr(expression: CastMethodCallExpr): MethodCallExpr {
  return {
    kind: "MethodCallExpr",
    receiver: lowerExpression(expression.receiver),
    method: expression.method,
    args: expression.args.map(lowerExpression),
    span: expression.span,
  };
}

function lowerPostfixPointerExpr(expression: CastPostfixPointerExpr): PostfixPointerExpr {
  return {
    kind: "PostfixPointerExpr",
    operator: expression.operator,
    operand: lowerExpression(expression.operand),
    span: expression.span,
  };
}

function lowerNonNullAssertExpr(expression: CastNonNullAssertExpr): NonNullAssertExpr {
  return {
    kind: "NonNullAssertExpr",
    operand: lowerExpression(expression.operand),
    span: expression.span,
  };
}

function lowerFieldAccessExpr(expression: CastFieldAccessExpr): FieldAccessExpr {
  return {
    kind: "FieldAccessExpr",
    operand: lowerExpression(expression.operand),
    field: expression.field,
    span: expression.span,
  };
}

function lowerOptionalFieldAccessExpr(
  expression: CastOptionalFieldAccessExpr,
): OptionalFieldAccessExpr {
  return {
    kind: "OptionalFieldAccessExpr",
    operand: lowerExpression(expression.operand),
    field: expression.field,
    span: expression.span,
  };
}

function lowerOptionalMethodCallExpr(
  expression: CastOptionalMethodCallExpr,
): OptionalMethodCallExpr {
  return {
    kind: "OptionalMethodCallExpr",
    receiver: lowerExpression(expression.receiver),
    method: expression.method,
    args: expression.args.map(lowerExpression),
    span: expression.span,
  };
}

function lowerOptionalIndexExpr(expression: CastOptionalIndexExpr): OptionalIndexExpr {
  return {
    kind: "OptionalIndexExpr",
    operand: lowerExpression(expression.operand),
    index: lowerExpression(expression.index),
    span: expression.span,
  };
}

function lowerRecordLiteralExpr(expression: CastRecordLiteralExpr): RecordLiteralExpr {
  return {
    kind: "RecordLiteralExpr",
    fields: expression.fields.map((field) => ({
      name: field.name,
      expression: lowerExpression(field.expression),
      span: field.span,
    })),
    span: expression.span,
  };
}

function lowerArrayLiteralExpr(expression: CastArrayLiteralExpr): ArrayLiteralExpr {
  return {
    kind: "ArrayLiteralExpr",
    elements: expression.elements.map(lowerExpression),
    span: expression.span,
  };
}

function lowerIndexExpr(expression: CastIndexExpr): IndexExpr {
  return {
    kind: "IndexExpr",
    operand: lowerExpression(expression.operand),
    index: lowerExpression(expression.index),
    span: expression.span,
  };
}
