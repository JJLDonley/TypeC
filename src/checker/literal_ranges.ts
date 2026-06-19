import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { integerRange, maxF32 } from "checker/types.ts";

type IntegerLiteral = Extract<Expression, { kind: "IntegerLiteral" }>;
type FloatLiteral = Extract<Expression, { kind: "FloatLiteral" }>;

export function checkIntegerLiteralRange(expr: IntegerLiteral, type: TypeName): Diagnostic[] {
  const range = integerRange(type);
  if (!range) return [];
  if (expr.value >= range.min && expr.value <= range.max) return [];
  return [{ message: `Integer literal '${expr.text}' is out of range for '${type}'`, span: expr.span }];
}

export function checkFloatLiteralRange(expr: FloatLiteral, type: TypeName): Diagnostic[] {
  if (type !== "f32") return [];
  if (Math.abs(expr.value) <= maxF32) return [];
  return [{ message: `Float literal '${expr.text}' is out of range for 'f32'`, span: expr.span }];
}

