import type { Expression, FunctionDecl } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallArguments } from "checker/calls.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

type CallExpr = Extract<Expression, { kind: "CallExpr" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type TypeResolver = (expr: Expression) => TypeName;

export interface CallExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkCallExpression(
  expr: CallExpr,
  fn: FunctionDecl | undefined,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
): CallExpressionCheck {
  if (!fn) return unknownFunction(expr.callee, expr.span);
  return {
    diagnostics: checkCallArguments(expr.args, fn, resolveExpectedType, resolveType, expr.span),
    type: typeName(fn.returnType),
  };
}

function unknownFunction(name: Str, span: Diagnostic["span"]): CallExpressionCheck {
  return { diagnostics: [{ message: `Unknown function '${name}'`, span }], type: "<error>" };
}
