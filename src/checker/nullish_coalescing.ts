import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type NullishCoalesceExpr = Extract<Expression, { kind: "NullishCoalesceExpr" }>;

type ExpressionTypeResolver = (expr: Expression) => TypeName;
type ExpectedExpressionTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface NullishCoalesceCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkNullishCoalesceExpression(
  expr: NullishCoalesceExpr,
  resolveType: ExpressionTypeResolver,
  resolveExpectedType: ExpectedExpressionTypeResolver,
): NullishCoalesceCheck {
  const leftType = resolveType(expr.left);
  const elementType = optionalTypeNameElement(leftType);
  if (elementType === null) return nonOptionalLeft(expr, leftType);
  const fallbackType = resolveExpectedType(expr.fallback, elementType);
  if (isAssignable(fallbackType, elementType)) return { diagnostics: [], type: elementType };
  return incompatibleFallback(expr, fallbackType, elementType);
}

function nonOptionalLeft(expr: NullishCoalesceExpr, type: TypeName): NullishCoalesceCheck {
  return {
    diagnostics: [
      {
        message: `Nullish coalescing requires optional left operand, got '${type}'`,
        span: expr.left.span,
      },
    ],
    type: "<error>",
  };
}

function incompatibleFallback(
  expr: NullishCoalesceExpr,
  actual: TypeName,
  expected: TypeName,
): NullishCoalesceCheck {
  return {
    diagnostics: [
      {
        message: `Nullish coalescing fallback type '${actual}' is not assignable to '${expected}'`,
        span: expr.fallback.span,
      },
    ],
    type: "<error>",
  };
}
