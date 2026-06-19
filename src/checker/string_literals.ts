import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayType } from "checker/types.ts";

type StringLiteral = Extract<Expression, { kind: "StringLiteral" }>;
type Str = string;
type usize = number;

export function stringLiteralType(expr: StringLiteral): TypeName {
  return `u8[${stringByteLength(expr.text) + 1}]`;
}

export function checkStringLiteralTarget(actual: TypeName, expected: TypeName, expr: StringLiteral): Diagnostic[] {
  if (expected === "u8*" || expected === "u8[]") return [];
  const array = parseArrayType(expected);
  if (array?.element === "u8") return [];
  return [{ message: `String literal is not assignable to '${expected}'`, span: expr.span }];
}

function stringByteLength(text: Str): usize {
  return new TextEncoder().encode(text).length;
}
