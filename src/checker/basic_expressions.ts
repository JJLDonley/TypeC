import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkIntegerLiteralRange } from "checker/literal_ranges.ts";
import { stringLiteralType } from "checker/string_literals.ts";

type b8 = boolean;

type BasicExpr = Extract<
  Expression,
  { kind: "IntegerLiteral" | "FloatLiteral" | "BoolLiteral" | "StringLiteral" }
>;

export interface BasicExpressionCheck {
  diagnostics: Diagnostic[];
  handled: b8;
  type: TypeName;
}

export function checkBasicExpression(expr: Expression): BasicExpressionCheck {
  if (!isBasicExpression(expr)) return { diagnostics: [], handled: false, type: "<error>" };
  return checkKnownBasicExpression(expr);
}

function checkKnownBasicExpression(expr: BasicExpr): BasicExpressionCheck {
  switch (expr.kind) {
    case "IntegerLiteral":
      return handled("i32", checkIntegerLiteralRange(expr, "i32"));
    case "FloatLiteral":
      return handled("f64", []);
    case "BoolLiteral":
      return handled("bool", []);
    case "StringLiteral":
      return handled(stringLiteralType(expr), [{
        message: "String literals require an expected C string type",
        span: expr.span,
      }]);
  }
}

function isBasicExpression(expr: Expression): expr is BasicExpr {
  return expr.kind === "IntegerLiteral" || expr.kind === "FloatLiteral" ||
    expr.kind === "BoolLiteral" || expr.kind === "StringLiteral";
}

function handled(type: TypeName, diagnostics: Diagnostic[]): BasicExpressionCheck {
  return { diagnostics, handled: true, type };
}
