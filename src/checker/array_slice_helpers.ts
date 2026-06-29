import { SLICE_ARITY, SLICE_BOUNDS, SLICE_INDEX_TYPE, SLICE_ORDER } from "core/diagnostic_codes.ts";
import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isIntegerType } from "checker/types.ts";
import { parseArrayTypeName, parseSliceTypeName } from "checker/type_name_shapes.ts";

type usize = number;
type IntLiteralValue = bigint;

type MethodCallExpr = Extract<Expression, { kind: "MethodCallExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;

export interface ArraySliceHelperCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkArraySliceHelper(
  expr: MethodCallExpr,
  receiverType: TypeName,
  resolveType: TypeResolver,
): ArraySliceHelperCheck | null {
  if (expr.method !== "slice") return null;
  const array = parseArrayTypeName(receiverType);
  if (array !== null) {
    return checkSliceCall(expr, `Slice<${array.element}>`, array.length, resolveType);
  }
  const slice = parseSliceTypeName(receiverType);
  if (slice !== null) {
    return checkSliceCall(expr, `Slice<${slice.element}>`, null, resolveType);
  }
  return null;
}

function checkSliceCall(
  expr: MethodCallExpr,
  resultType: TypeName,
  length: IntLiteralValue | null,
  resolveType: TypeResolver,
): ArraySliceHelperCheck {
  return {
    diagnostics: [
      ...checkSliceArity(expr),
      ...checkSliceIndexTypes(expr, resolveType),
      ...checkSliceBounds(expr, length),
    ],
    type: resultType,
  };
}

function checkSliceArity(expr: MethodCallExpr): Diagnostic[] {
  if (expr.args.length === 2) return [];
  return [{ message: "slice expects 2 arguments", code: SLICE_ARITY, span: expr.span }];
}

function checkSliceIndexTypes(expr: MethodCallExpr, resolveType: TypeResolver): Diagnostic[] {
  return expr.args.flatMap((arg, index) => checkSliceIndexType(arg, index, resolveType(arg)));
}

function checkSliceIndexType(
  arg: Expression,
  index: usize,
  type: TypeName,
): Diagnostic[] {
  if (isIntegerType(type)) return [];
  return [{
    message: `slice argument ${index + 1} type '${type}' is not an integer`,
    code: SLICE_INDEX_TYPE,
    span: arg.span,
  }];
}

function checkSliceBounds(expr: MethodCallExpr, length: IntLiteralValue | null): Diagnostic[] {
  const start = integerLiteralValue(expr.args[0]);
  const end = integerLiteralValue(expr.args[1]);
  return [
    ...checkSliceOrder(expr, start, end),
    ...checkSliceUpperBound(expr, end, length),
  ];
}

function checkSliceOrder(
  expr: MethodCallExpr,
  start: IntLiteralValue | null,
  end: IntLiteralValue | null,
): Diagnostic[] {
  if (start === null || end === null || start <= end) return [];
  return [{
    message: "slice start must be less than or equal to end",
    code: SLICE_ORDER,
    span: expr.span,
  }];
}

function checkSliceUpperBound(
  expr: MethodCallExpr,
  end: IntLiteralValue | null,
  length: IntLiteralValue | null,
): Diagnostic[] {
  if (end === null || length === null || end <= length) return [];
  return [{
    message: `slice end ${end} is out of bounds for length ${length}`,
    code: SLICE_BOUNDS,
    span: expr.args[1]?.span,
  }];
}

function integerLiteralValue(expr: Expression | undefined): IntLiteralValue | null {
  if (expr?.kind !== "IntegerLiteral") return null;
  return expr.value;
}
