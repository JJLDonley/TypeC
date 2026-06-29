import type { Expression } from "core/ast.ts";
import { EXPRESSION_STATEMENT_CALL } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";

export function checkExpressionStatement(expression: Expression): Diagnostic[] {
  if (expression.kind === "CallExpr" || expression.kind === "MethodCallExpr") return [];
  return [{
    message: "Expression statements must be function calls",
    code: EXPRESSION_STATEMENT_CALL,
    span: expression.span,
  }];
}
