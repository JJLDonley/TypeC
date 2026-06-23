import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayLiteralExpression } from "checker/array_literal_expressions.ts";
import { checkFloatLiteralRange, checkIntegerLiteralRange } from "checker/literal_ranges.ts";
import { checkRecordLiteralExpression } from "checker/record_literal_expressions.ts";
import { checkStringLiteralTarget, stringLiteralType } from "checker/string_literals.ts";
import { isFloatType, isIntegerType } from "checker/types.ts";

type Str = string;
type b8 = boolean;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface ExpectedExpressionCheck {
  diagnostics: Diagnostic[];
  handled: b8;
  type: TypeName;
}

export function checkExpectedExpression(
  expr: Expression,
  expected: TypeName,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
): ExpectedExpressionCheck {
  if (expr.kind === "ZeroValueExpr") return handled(expected, []);
  if (expr.kind === "IntegerLiteral" && isIntegerType(expected)) {
    return handled(expected, checkIntegerLiteralRange(expr, expected));
  }
  if (expr.kind === "FloatLiteral" && isFloatType(expected)) {
    return handled(expected, checkFloatLiteralRange(expr, expected));
  }
  if (expr.kind === "RecordLiteralExpr") {
    return handledCheck(checkRecordLiteralExpression(expr, expected, aliases, resolveExpectedType));
  }
  if (expr.kind === "ArrayLiteralExpr") {
    return handledCheck(checkArrayLiteralExpression(expr, expected, resolveExpectedType));
  }
  if (expr.kind === "StringLiteral") {
    const type = stringLiteralType(expr);
    return handled(type, checkStringLiteralTarget(type, expected, expr));
  }
  return { diagnostics: [], handled: false, type: "<error>" };
}

function handled(type: TypeName, diagnostics: Diagnostic[]): ExpectedExpressionCheck {
  return { diagnostics, handled: true, type };
}

function handledCheck(
  check: { diagnostics: Diagnostic[]; type: TypeName },
): ExpectedExpressionCheck {
  return { diagnostics: check.diagnostics, handled: true, type: check.type };
}
