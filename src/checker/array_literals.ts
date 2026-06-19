import type { Diagnostic } from "../diagnostics.ts";
import type { Expression } from "../ast.ts";
import type { TypeName } from "../tast.ts";
import { isAssignable, parseArrayType } from "checker/types.ts";

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

export function checkArrayLiteralTarget(expected: TypeName, expr: ArrayLiteralExpr): ArrayLiteralTargetCheck {
  const array = parseArrayType(expected);
  if (array) return { array, diagnostics: [] };
  return { array: null, diagnostics: [{ message: `Array literal is not assignable to non-array type '${expected}'`, span: expr.span }] };
}

export function checkInferredArrayLiteral(expr: ArrayLiteralExpr, array: ExpectedArrayType): Diagnostic[] {
  if (array.length !== null) return [];
  if (expr.elements.length > 0) return [];
  return [{ message: "Cannot infer empty array type", span: expr.span }];
}

export function checkArrayLiteralElementType(actual: TypeName, expectedElement: TypeName, element: Expression): Diagnostic[] {
  if (isAssignable(actual, expectedElement)) return [];
  return [{ message: `Array element type '${actual}' is not assignable to '${expectedElement}'`, span: element.span }];
}

export function checkArrayLiteralLength(elementCount: usize, array: ExpectedArrayType, expected: TypeName, expr: ArrayLiteralExpr): Diagnostic[] {
  if (array.length === null) return [];
  if (array.length === BigInt(elementCount)) return [];
  return [{ message: `Array length ${elementCount} is not assignable to '${expected}'`, span: expr.span }];
}
