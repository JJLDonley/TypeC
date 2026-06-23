import type { Expression } from "core/ast.ts";

type Str = string;

export function qualifiedExpressionName(expr: Expression): Str | null {
  if (expr.kind === "IdentifierExpr") return expr.name;
  if (expr.kind !== "FieldAccessExpr") return null;
  const operand = qualifiedExpressionName(expr.operand);
  return operand === null ? null : `${operand}.${expr.field}`;
}
