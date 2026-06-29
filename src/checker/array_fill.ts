import type { Expression } from "core/ast.ts";
import {
  ARRAY_FILL_ARITY,
  ARRAY_FILL_CALLBACK_PARAMETER,
  ARRAY_FILL_INITIALIZER_TYPE,
  ARRAY_FILL_TARGET,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

type b8 = boolean;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface ArrayFillCheck {
  diagnostics: Diagnostic[];
  handled: b8;
  type: TypeName;
}

export function checkArrayFillExpression(
  expr: Expression,
  expected: TypeName,
  resolveExpectedType: TypeResolver,
): ArrayFillCheck {
  if (!isArrayFillCall(expr)) return unhandled();
  const array = parseArrayTypeName(expected);
  if (array === null || array.length === null) {
    return handled("<error>", [{
      message: "Array.fill requires an expected fixed array type",
      code: ARRAY_FILL_TARGET,
      span: expr.span,
    }]);
  }
  if (expr.args.length !== 1) {
    return handled("<error>", [{
      message: "Array.fill expects exactly one initializer",
      code: ARRAY_FILL_ARITY,
      span: expr.span,
    }]);
  }
  const initializer = expr.args[0]!;
  if (initializer.kind === "ArrowFunctionExpr") {
    if (initializer.params.length !== 1) {
      return handled("<error>", [{
        message: "Array.fill callback expects one index parameter",
        code: ARRAY_FILL_CALLBACK_PARAMETER,
        span: initializer.span,
      }]);
    }
    resolveExpectedType(initializer, `(index: usize) => ${array.element}`);
    return handled(expected, []);
  }
  const actual = resolveExpectedType(initializer, array.element);
  if (actual !== array.element) {
    return handled(expected, [{
      message:
        `Array.fill initializer type '${actual}' is not assignable to element type '${array.element}'`,
      code: ARRAY_FILL_INITIALIZER_TYPE,
      span: initializer.span,
    }]);
  }
  return handled(expected, []);
}

function isArrayFillCall(
  expr: Expression,
): expr is Extract<Expression, { kind: "MethodCallExpr" }> {
  return expr.kind === "MethodCallExpr" && expr.receiver.kind === "IdentifierExpr" &&
    expr.receiver.name === "Array" && expr.method === "fill";
}

function handled(type: TypeName, diagnostics: Diagnostic[]): ArrayFillCheck {
  return { diagnostics, handled: true, type };
}

function unhandled(): ArrayFillCheck {
  return { diagnostics: [], handled: false, type: "<error>" };
}
