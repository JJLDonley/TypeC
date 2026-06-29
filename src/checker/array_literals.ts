import {
  ARRAY_LITERAL_ELEMENT_TYPE,
  ARRAY_LITERAL_INFERENCE,
  ARRAY_LITERAL_LENGTH,
  ARRAY_LITERAL_TARGET,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayTypeName, parseSliceTypeName } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type usize = number;
type IntLiteralValue = bigint;

type ArrayLiteralExpr = Extract<Expression, { kind: "ArrayLiteralExpr" }>;

export interface ExpectedArrayType {
  element: TypeName;
  length: IntLiteralValue | null;
}

export interface ArrayLiteralTargetCheck {
  array: ExpectedArrayType | null;
  diagnostics: Diagnostic[];
}

export function checkArrayLiteralTarget(
  expected: TypeName,
  expr: ArrayLiteralExpr,
): ArrayLiteralTargetCheck {
  const array = parseArrayTypeName(expected);
  if (array) return { array, diagnostics: [] };
  const slice = parseSliceTypeName(expected);
  if (slice) return { array: { element: slice.element, length: null }, diagnostics: [] };
  return {
    array: null,
    diagnostics: [{
      message: `Array literal is not assignable to non-array type '${expected}'`,
      code: ARRAY_LITERAL_TARGET,
      span: expr.span,
    }],
  };
}

export function checkInferredArrayLiteral(
  expr: ArrayLiteralExpr,
  array: ExpectedArrayType,
): Diagnostic[] {
  if (array.length !== null) return [];
  if (expr.elements.length > 0) return [];
  return [{
    message: "Cannot infer empty array type",
    code: ARRAY_LITERAL_INFERENCE,
    span: expr.span,
  }];
}

export function checkArrayLiteralElementType(
  actual: TypeName,
  expectedElement: TypeName,
  element: Expression,
): Diagnostic[] {
  if (isAssignable(actual, expectedElement)) return [];
  return [{
    message: `Array element type '${actual}' is not assignable to '${expectedElement}'`,
    code: ARRAY_LITERAL_ELEMENT_TYPE,
    span: element.span,
  }];
}

export function checkArrayLiteralLength(
  elementCount: usize,
  array: ExpectedArrayType,
  expected: TypeName,
  expr: ArrayLiteralExpr,
): Diagnostic[] {
  if (array.length === null) return [];
  if (array.length === BigInt(elementCount)) return [];
  return [{
    message: `Array length ${elementCount} is not assignable to '${expected}'`,
    code: ARRAY_LITERAL_LENGTH,
    span: expr.span,
  }];
}
