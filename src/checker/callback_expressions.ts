import type { Expression, FunctionDecl } from "core/ast.ts";
import { CALLBACK_TYPE } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { functionTypeName } from "checker/function_type_names.ts";
import { parseFunctionTypeName } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;
type b8 = boolean;

export interface CallbackExpressionCheck {
  diagnostics: Diagnostic[];
  handled: b8;
  type: TypeName;
}

export function checkExpectedCallbackExpression(
  expr: Expression,
  expected: TypeName,
  functions: Map<Str, FunctionDecl>,
): CallbackExpressionCheck {
  if (!parseFunctionTypeName(expected) || expr.kind !== "IdentifierExpr") return unhandled();
  const fn = functions.get(expr.name);
  if (!fn) return unhandled();
  const actual = functionTypeName(fn);
  if (isAssignable(actual, expected)) return handled(actual, []);
  return handled(actual, [{
    message: `Callback '${expr.name}' type '${actual}' is not assignable to '${expected}'`,
    code: CALLBACK_TYPE,
    span: expr.span,
  }]);
}

function handled(type: TypeName, diagnostics: Diagnostic[]): CallbackExpressionCheck {
  return { diagnostics, handled: true, type };
}

function unhandled(): CallbackExpressionCheck {
  return { diagnostics: [], handled: false, type: "<error>" };
}
