import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayIndex } from "checker/array_indexes.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

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
  if (!array) {
    return {
      diagnostics: [{ message: `Cannot index non-array type '${operandType}'`, span: expr.span }],
      type: "<error>",
    };
  }
  const index = resolveType(expr.index);
  return { diagnostics: checkArrayIndex(expr.index, index, array.length), type: array.element };
}
