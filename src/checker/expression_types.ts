import type { Expression } from "core/ast.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkBasicExpression } from "checker/basic_expressions.ts";

type Str = string;

type BasicExpr = Extract<
  Expression,
  { kind: "IntegerLiteral" | "FloatLiteral" | "BoolLiteral" | "StringLiteral" }
>;
type NonBasicExpr = Exclude<Expression, BasicExpr>;

export interface ExpressionTypeHandlers {
  identifier(name: Str, span: SourceSpan): TypeName;
  unary(expr: Extract<Expression, { kind: "UnaryExpr" }>): TypeName;
  binary(expr: Extract<Expression, { kind: "BinaryExpr" }>): TypeName;
  conditional(expr: Extract<Expression, { kind: "ConditionalExpr" }>): TypeName;
  call(expr: Extract<Expression, { kind: "CallExpr" }>): TypeName;
  methodCall(expr: Extract<Expression, { kind: "MethodCallExpr" }>): TypeName;
  pointer(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>): TypeName;
  nonNullAssert(expr: Extract<Expression, { kind: "NonNullAssertExpr" }>): TypeName;
  fieldAccess(expr: Extract<Expression, { kind: "FieldAccessExpr" }>): TypeName;
  index(expr: Extract<Expression, { kind: "IndexExpr" }>): TypeName;
}

export interface ExpressionTypeCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function computeExpressionType(
  expr: Expression,
  handlers: ExpressionTypeHandlers,
): ExpressionTypeCheck {
  const basic = checkBasicExpression(expr);
  if (basic.handled) return { diagnostics: basic.diagnostics, type: basic.type };
  if (!isNonBasicExpression(expr)) return { diagnostics: [], type: basic.type };
  return computeNonBasicExpressionType(expr, handlers);
}

function computeNonBasicExpressionType(
  expr: NonBasicExpr,
  handlers: ExpressionTypeHandlers,
): ExpressionTypeCheck {
  switch (expr.kind) {
    case "IdentifierExpr":
      return ok(handlers.identifier(expr.name, expr.span));
    case "UnaryExpr":
      return ok(handlers.unary(expr));
    case "BinaryExpr":
      return ok(handlers.binary(expr));
    case "ConditionalExpr":
      return ok(handlers.conditional(expr));
    case "CallExpr":
      return ok(handlers.call(expr));
    case "MethodCallExpr":
      return ok(handlers.methodCall(expr));
    case "PostfixPointerExpr":
      return ok(handlers.pointer(expr));
    case "NonNullAssertExpr":
      return ok(handlers.nonNullAssert(expr));
    case "FieldAccessExpr":
      return ok(handlers.fieldAccess(expr));
    case "IndexExpr":
      return ok(handlers.index(expr));
    case "RecordLiteralExpr":
      return error("Record literals require an expected record type", expr.span);
    case "ArrayLiteralExpr":
      return error("Array literals require an expected array type", expr.span);
  }
}

function isNonBasicExpression(expr: Expression): expr is NonBasicExpr {
  return expr.kind === "IdentifierExpr" || expr.kind === "UnaryExpr" ||
    expr.kind === "BinaryExpr" || expr.kind === "ConditionalExpr" ||
    expr.kind === "CallExpr" || expr.kind === "MethodCallExpr" ||
    expr.kind === "PostfixPointerExpr" || expr.kind === "NonNullAssertExpr" ||
    expr.kind === "FieldAccessExpr" || expr.kind === "IndexExpr" ||
    expr.kind === "RecordLiteralExpr" || expr.kind === "ArrayLiteralExpr";
}

function ok(type: TypeName): ExpressionTypeCheck {
  return { diagnostics: [], type };
}

function error(message: Str, span: SourceSpan): ExpressionTypeCheck {
  return { diagnostics: [{ message, span }], type: "<error>" };
}
