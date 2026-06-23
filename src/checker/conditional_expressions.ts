import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;

type ConditionalExpr = Extract<Expression, { kind: "ConditionalExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface ConditionalExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkConditionalExpression(
  expr: ConditionalExpr,
  resolveType: TypeResolver,
  resolveExpectedType: ExpectedTypeResolver,
): ConditionalExpressionCheck {
  const conditionType = resolveType(expr.condition);
  const diagnostics = conditionDiagnostics(expr, conditionType);
  const trueType = resolveType(expr.whenTrue);
  const falseType = resolveExpectedType(expr.whenFalse, trueType);
  if (isAssignable(falseType, trueType)) return { diagnostics, type: trueType };
  const fallbackFalseType = resolveType(expr.whenFalse);
  if (isAssignable(trueType, fallbackFalseType)) return { diagnostics, type: fallbackFalseType };
  return {
    diagnostics: [...diagnostics, branchDiagnostic(expr, trueType, fallbackFalseType)],
    type: "<error>",
  };
}

function conditionDiagnostics(expr: ConditionalExpr, type: TypeName): Diagnostic[] {
  if (type === "bool") return [];
  return [{ message: "Conditional expression condition must be bool", span: expr.condition.span }];
}

function branchDiagnostic(
  expr: ConditionalExpr,
  trueType: TypeName,
  falseType: TypeName,
): Diagnostic {
  return {
    message: `Conditional branches have incompatible types '${trueType}' and '${falseType}'`,
    span: expr.span,
  };
}
