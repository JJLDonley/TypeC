import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import {
  checkArrayLiteralElementType,
  checkArrayLiteralLength,
  checkArrayLiteralTarget,
  checkInferredArrayLiteral,
} from "checker/array_literals.ts";

type ArrayLiteralExpr = Extract<Expression, { kind: "ArrayLiteralExpr" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface ArrayLiteralExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkArrayLiteralExpression(expr: ArrayLiteralExpr, expected: TypeName, resolveExpectedType: ExpectedTypeResolver): ArrayLiteralExpressionCheck {
  const target = checkArrayLiteralTarget(expected, expr);
  if (!target.array) return { diagnostics: target.diagnostics, type: "<error>" };
  const diagnostics = [...target.diagnostics, ...checkInferredArrayLiteral(expr, target.array)];
  for (const element of expr.elements) {
    const actual = resolveExpectedType(element, target.array.element);
    diagnostics.push(...checkArrayLiteralElementType(actual, target.array.element, element));
  }
  diagnostics.push(...checkArrayLiteralLength(expr.elements.length, target.array, expected, expr));
  return { diagnostics, type: `${target.array.element}[${expr.elements.length}]` };
}
