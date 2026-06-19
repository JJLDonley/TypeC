import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkPostfixPointerOperation } from "checker/pointer_ops.ts";

type PostfixPointerExpr = Extract<Expression, { kind: "PostfixPointerExpr" }>;

export interface PointerExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkPostfixPointerExpression(expr: PostfixPointerExpr, operandType: TypeName): PointerExpressionCheck {
  return checkPostfixPointerOperation(expr, operandType);
}
