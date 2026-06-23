import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function isLogicalBinaryOperator(operator: Str): b8 {
  return operator === "&&" || operator === "||";
}

export function isBitwiseBinaryOperator(operator: Str): b8 {
  return operator === "&" || operator === "|" || operator === "^";
}

export function isShiftOperator(operator: Str): b8 {
  return operator === "<<" || operator === ">>" || operator === ">>>";
}

export function isComparisonOperator(operator: Str): b8 {
  return operator === "<" || operator === "<=" || operator === ">" || operator === ">=" ||
    operator === "==" || operator === "!=";
}

export function isIntegerZeroLiteral(expr: Expression): b8 {
  return expr.kind === "IntegerLiteral" && expr.value === 0n;
}

export function isAddressable(expr: Expression): b8 {
  switch (expr.kind) {
    case "IdentifierExpr":
    case "IndexExpr":
      return true;
    case "FieldAccessExpr":
      return isAddressable(expr.operand);
    case "PostfixPointerExpr":
      return expr.operator === ".*";
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
    case "UnaryExpr":
    case "BinaryExpr":
    case "ConditionalExpr":
    case "NullishCoalesceExpr":
    case "NonNullAssertExpr":
    case "CallExpr":
    case "NewExpr":
    case "MethodCallExpr":
    case "OptionalFieldAccessExpr":
    case "OptionalMethodCallExpr":
    case "OptionalIndexExpr":
    case "RecordLiteralExpr":
    case "ArrayLiteralExpr":
      return false;
  }
}

export function spanKey(span: SourceSpan): Str {
  return `${span.start.offset}:${span.end.offset}`;
}
