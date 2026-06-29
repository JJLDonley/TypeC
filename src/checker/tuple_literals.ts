import type { Expression } from "core/ast.ts";
import { TUPLE_LITERAL_ELEMENT_TYPE, TUPLE_LITERAL_LENGTH } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { parseTupleTypeName } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

export type usize = number;
type b8 = boolean;

type ArrayLiteralExpr = Extract<Expression, { kind: "ArrayLiteralExpr" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface TupleLiteralCheck {
  handled: b8;
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkTupleLiteralExpression(
  expr: ArrayLiteralExpr,
  expected: TypeName,
  resolveExpectedType: ExpectedTypeResolver,
): TupleLiteralCheck {
  const tuple = parseTupleTypeName(expected);
  if (tuple === null) return { handled: false, diagnostics: [], type: "<error>" };
  const diagnostics = checkTupleLength(expr, tuple.elements);
  for (
    let index: usize = 0;
    index < expr.elements.length && index < tuple.elements.length;
    index++
  ) {
    const expectedElement = tuple.elements[index]!;
    const actual = resolveExpectedType(expr.elements[index]!, expectedElement);
    if (!isAssignable(actual, expectedElement)) {
      diagnostics.push({
        message: `Tuple element type '${actual}' is not assignable to '${expectedElement}'`,
        code: TUPLE_LITERAL_ELEMENT_TYPE,
        span: expr.elements[index]!.span,
      });
    }
  }
  return { handled: true, diagnostics, type: expected };
}

function checkTupleLength(expr: ArrayLiteralExpr, elements: TypeName[]): Diagnostic[] {
  if (expr.elements.length === elements.length) return [];
  return [{
    message:
      `Tuple literal length ${expr.elements.length} does not match expected length ${elements.length}`,
    code: TUPLE_LITERAL_LENGTH,
    span: expr.span,
  }];
}
