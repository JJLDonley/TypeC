import {
  UNARY_BOOL_OPERAND,
  UNARY_INTEGER_OPERAND,
  UNARY_NUMERIC_OPERAND,
} from "core/diagnostic_codes.ts";
import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isIntegerType, isNumericType } from "checker/types.ts";

type UnaryExpr = Extract<Expression, { kind: "UnaryExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;

export interface UnaryExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkUnaryExpression(
  expr: UnaryExpr,
  resolveType: TypeResolver,
): UnaryExpressionCheck {
  const type = resolveType(expr.operand);
  if (expr.operator === "!") return checkLogicalNot(expr, type);
  if (expr.operator === "~") return checkBitwiseNot(expr, type);
  return checkNumericUnary(expr, type);
}

function checkLogicalNot(expr: UnaryExpr, type: TypeName): UnaryExpressionCheck {
  if (type === "bool") return { diagnostics: [], type: "bool" };
  return {
    diagnostics: [{
      message: "Operator '!' requires a bool operand",
      code: UNARY_BOOL_OPERAND,
      span: expr.span,
    }],
    type: "<error>",
  };
}

function checkBitwiseNot(expr: UnaryExpr, type: TypeName): UnaryExpressionCheck {
  if (isIntegerType(type)) return { diagnostics: [], type };
  return {
    diagnostics: [{
      message: "Operator '~' requires an integer operand",
      code: UNARY_INTEGER_OPERAND,
      span: expr.span,
    }],
    type: "<error>",
  };
}

function checkNumericUnary(expr: UnaryExpr, type: TypeName): UnaryExpressionCheck {
  if (isNumericType(type)) return { diagnostics: [], type };
  return {
    diagnostics: [{
      message: `Operator '${expr.operator}' requires a numeric operand`,
      code: UNARY_NUMERIC_OPERAND,
      span: expr.span,
    }],
    type: "<error>",
  };
}
