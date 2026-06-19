import type { Expression } from "./ast.ts";
import type { SourceSpan } from "./diagnostics.ts";

type Str = string;
type b8 = boolean;

export function isComparisonOperator(operator: Str): b8 {
  return operator === "<" || operator === "<=" || operator === ">" || operator === ">=" || operator === "==" || operator === "!=";
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
    case "BinaryExpr":
    case "CallExpr":
    case "RecordLiteralExpr":
    case "ArrayLiteralExpr":
      return false;
  }
}

export function spanKey(span: SourceSpan): Str {
  return `${span.start.offset}:${span.end.offset}`;
}
