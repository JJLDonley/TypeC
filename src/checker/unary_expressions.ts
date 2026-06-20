import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isNumericType } from "checker/types.ts";

type UnaryExpr = Extract<Expression, { kind: "UnaryExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;

export interface UnaryExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkUnaryExpression(
  expr: UnaryExpr,
  resolveType: TypeResolver,
): UnaryExpressionCheck {
  const type = resolveType(expr.operand);
  if (isNumericType(type)) return { diagnostics: [], type };
  return {
    diagnostics: [{
      message: `Operator '${expr.operator}' requires a numeric operand`,
      span: expr.span,
    }],
    type: "<error>",
  };
}
