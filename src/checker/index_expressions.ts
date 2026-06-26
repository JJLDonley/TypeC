import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayIndex } from "checker/array_indexes.ts";
import { parseArrayTypeName, parseSliceTypeName, parseTupleTypeName } from "checker/type_name_shapes.ts";

type IndexExpr = Extract<Expression, { kind: "IndexExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;

export interface IndexExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkIndexExpression(
  expr: IndexExpr,
  operandType: TypeName,
  resolveType: TypeResolver,
): IndexExpressionCheck {
  const array = parseArrayTypeName(operandType);
  if (array) {
    const index = resolveType(expr.index);
    return { diagnostics: checkArrayIndex(expr.index, index, array.length), type: array.element };
  }
  const tuple = parseTupleTypeName(operandType);
  if (tuple) return checkTupleIndexExpression(expr, tuple.elements);
  const slice = parseSliceTypeName(operandType);
  if (slice) {
    const index = resolveType(expr.index);
    return { diagnostics: checkArrayIndex(expr.index, index, null), type: slice.element };
  }
  return {
    diagnostics: [{ message: `Cannot index non-array type '${operandType}'`, span: expr.span }],
    type: "<error>",
  };
}

function checkTupleIndexExpression(expr: IndexExpr, elements: TypeName[]): IndexExpressionCheck {
  if (expr.index.kind !== "IntegerLiteral") {
    return {
      diagnostics: [{ message: "Tuple index must be an integer literal", span: expr.index.span }],
      type: "<error>",
    };
  }
  const index = Number(expr.index.value);
  if (index < 0 || index >= elements.length) {
    return {
      diagnostics: [{ message: `Tuple index ${expr.index.text} is out of bounds`, span: expr.index.span }],
      type: "<error>",
    };
  }
  return { diagnostics: [], type: elements[index]! };
}
