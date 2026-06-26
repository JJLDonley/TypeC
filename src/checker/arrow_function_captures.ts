import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { LocalInfo } from "checker/locals.ts";

type Str = string;
type b8 = boolean;

export function checkArrowFunctionCaptures(
  expr: Extract<Expression, { kind: "ArrowFunctionExpr" }>,
  locals: Map<Str, LocalInfo>,
): Diagnostic[] {
  const params = new Set<Str>(expr.params);
  return capturedLocalNames(expr.body, params, locals).map((name) => ({
    message: `Arrow function cannot capture local '${name}'`,
    span: expr.span,
  }));
}

function capturedLocalNames(
  expr: Expression,
  params: Set<Str>,
  locals: Map<Str, LocalInfo>,
): Str[] {
  return [...identifierNames(expr)].filter((name) => isCapturedLocal(name, params, locals));
}

function isCapturedLocal(name: Str, params: Set<Str>, locals: Map<Str, LocalInfo>): b8 {
  return !params.has(name) && locals.has(name);
}

function identifierNames(expr: Expression): Set<Str> {
  const names = new Set<Str>();
  collectIdentifierNames(expr, names);
  return names;
}

function collectIdentifierNames(expr: Expression, names: Set<Str>): void {
  switch (expr.kind) {
    case "IdentifierExpr":
      names.add(expr.name);
      return;
    case "UnaryExpr":
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
    case "FieldAccessExpr":
    case "OptionalFieldAccessExpr":
      collectIdentifierNames(expr.operand, names);
      return;
    case "BinaryExpr":
      collectIdentifierNames(expr.left, names);
      collectIdentifierNames(expr.right, names);
      return;
    case "ConditionalExpr":
      collectIdentifierNames(expr.condition, names);
      collectIdentifierNames(expr.whenTrue, names);
      collectIdentifierNames(expr.whenFalse, names);
      return;
    case "NullishCoalesceExpr":
      collectIdentifierNames(expr.left, names);
      collectIdentifierNames(expr.fallback, names);
      return;
    case "CallExpr":
    case "NewExpr":
      for (const arg of expr.args) collectIdentifierNames(arg, names);
      return;
    case "MethodCallExpr":
    case "OptionalMethodCallExpr":
      collectIdentifierNames(expr.receiver, names);
      for (const arg of expr.args) collectIdentifierNames(arg, names);
      return;
    case "OptionalIndexExpr":
    case "IndexExpr":
      collectIdentifierNames(expr.operand, names);
      collectIdentifierNames(expr.index, names);
      return;
    case "RecordLiteralExpr":
      for (const field of expr.fields) collectIdentifierNames(field.expression, names);
      return;
    case "ArrayLiteralExpr":
      for (const element of expr.elements) collectIdentifierNames(element, names);
      return;
    case "ArrowFunctionExpr":
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
      return;
  }
}
