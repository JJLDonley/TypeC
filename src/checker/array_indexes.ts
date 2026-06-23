import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isIntegerType } from "checker/types.ts";

type IntLiteralValue = bigint;

export function checkArrayIndex(
  index: Expression,
  indexType: TypeName,
  length: IntLiteralValue | null,
): Diagnostic[] {
  return [
    ...checkArrayIndexType(index, indexType),
    ...checkArrayIndexBounds(index, length),
  ];
}

function checkArrayIndexType(index: Expression, indexType: TypeName): Diagnostic[] {
  if (isIntegerType(indexType)) return [];
  return [{ message: `Array index type '${indexType}' is not an integer`, span: index.span }];
}

function checkArrayIndexBounds(index: Expression, length: IntLiteralValue | null): Diagnostic[] {
  if (length === null) return [];
  if (index.kind !== "IntegerLiteral") return [];
  if (index.value < length) return [];
  return [{
    message: `Array index ${index.text} is out of bounds for length ${length}`,
    span: index.span,
  }];
}
