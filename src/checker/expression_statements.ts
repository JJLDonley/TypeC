import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";

export function checkExpressionStatement(expression: Expression): Diagnostic[] {
  if (expression.kind === "CallExpr") return [];
  return [{ message: "Expression statements must be function calls", span: expression.span }];
}
