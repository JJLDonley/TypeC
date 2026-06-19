import { cStringByteLength } from "core/c_strings.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayType } from "checker/types.ts";

type StringLiteral = Extract<Expression, { kind: "StringLiteral" }>;
type b8 = boolean;

export function stringLiteralType(expr: StringLiteral): TypeName {
  return `u8[${cStringByteLength(expr.text)}]`;
}

export function isStringLiteralArrayInitializer(initializer: Expression, expected: TypeName): b8 {
  return initializer.kind === "StringLiteral" && parseArrayType(expected)?.element === "u8";
}

export function checkStringLiteralTarget(actual: TypeName, expected: TypeName, expr: StringLiteral): Diagnostic[] {
  if (expected === "u8*" || expected === "u8[]" || expected === "void*") return [];
  const array = parseArrayType(expected);
  if (array?.element !== "u8") return [{ message: `String literal is not assignable to '${expected}'`, span: expr.span }];
  const actualLength = parseArrayType(actual)?.length ?? null;
  if (array.length !== null && actualLength !== null && actualLength > array.length) return [{ message: `String literal length ${actualLength} is not assignable to '${expected}'`, span: expr.span }];
  return [];
}
