import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";

export interface NonNullAssertCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

type NonNullAssertExpr = Extract<Expression, { kind: "NonNullAssertExpr" }>;

type ExpressionTypeResolver = (expr: Expression) => TypeName;

export function checkNonNullAssertExpression(
  expr: NonNullAssertExpr,
  resolveType: ExpressionTypeResolver,
): NonNullAssertCheck {
  const operandType = resolveType(expr.operand);
  const elementType = optionalTypeNameElement(operandType);
  if (elementType !== null) return { diagnostics: [], type: elementType };
  return {
    diagnostics: [{
      message: `Non-null assertion requires optional type, got '${operandType}'`,
      span: expr.span,
    }],
    type: "<error>",
  };
}
