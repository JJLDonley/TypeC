import type { TypeName } from "core/tast.ts";
import {
  isPointerLikeTypeName,
  parseArrayTypeName,
  parseSafePointerTypeName,
  pointeeTypeName,
} from "checker/type_name_shapes.ts";

type b8 = boolean;

export function isPointerAssignable(actual: TypeName, expected: TypeName): b8 {
  if (isVoidPointerTarget(actual, expected)) return true;
  if (isSafePointerToRawPointer(actual, expected)) return true;
  if (isReferenceToPointerLike(actual, expected)) {
    return pointeeTypeName(actual) === pointeeTypeName(expected);
  }
  return false;
}

export function isArrayPointerAssignable(actual: TypeName, expected: TypeName): b8 {
  const actualArray = parseArrayTypeName(actual);
  if (!actualArray || !expected.endsWith("*")) return false;
  return expected === "void*" || actualArray.element === pointeeTypeName(expected);
}

function isVoidPointerTarget(actual: TypeName, expected: TypeName): b8 {
  return expected === "void*" && isPointerLikeTypeName(actual) &&
    pointeeTypeName(actual) !== "void";
}

function isSafePointerToRawPointer(actual: TypeName, expected: TypeName): b8 {
  return parseSafePointerTypeName(actual) !== null && expected.endsWith("*") &&
    pointeeTypeName(actual) === pointeeTypeName(expected);
}

function isReferenceToPointerLike(actual: TypeName, expected: TypeName): b8 {
  return actual.endsWith("&") && isPointerLikeTypeName(expected);
}
