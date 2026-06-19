import type { TypeName } from "core/tast.ts";

type b8 = boolean;
type IntLiteralValue = bigint;

export function isPointerAssignable(actual: TypeName, expected: TypeName): b8 {
  if (isVoidPointerTarget(actual, expected)) return true;
  if (isReferenceToPointerLike(actual, expected)) return pointeeType(actual) === pointeeType(expected);
  return false;
}

export function isArrayPointerAssignable(actual: TypeName, expected: TypeName): b8 {
  const actualArray = parseArrayType(actual);
  if (!actualArray || !expected.endsWith("*")) return false;
  return expected === "void*" || actualArray.element === pointeeType(expected);
}

function parseArrayType(type: TypeName): { element: TypeName; length: IntLiteralValue | null } | null {
  const match = type.match(/^(.+)\[(\d*)\]$/);
  if (!match) return null;
  return { element: match[1], length: match[2] ? BigInt(match[2]) : null };
}

function isVoidPointerTarget(actual: TypeName, expected: TypeName): b8 {
  return expected === "void*" && isPointerLikeType(actual) && pointeeType(actual) !== "void";
}

function isReferenceToPointerLike(actual: TypeName, expected: TypeName): b8 {
  return actual.endsWith("&") && isPointerLikeType(expected);
}

function isPointerLikeType(type: TypeName): b8 {
  return type.endsWith("*") || type.endsWith("&");
}

function pointeeType(type: TypeName): TypeName {
  return type.slice(0, -1);
}
