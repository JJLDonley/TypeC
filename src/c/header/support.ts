import type { CHeaderFunction } from "c/header/ast.ts";
import { cArrayElementType, cPointerToArrayShape } from "c/header/array_types.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { isPathWithinDir } from "paths";

type Str = string;
type b8 = boolean;

export function isIncludedHeaderFunction(fn: CHeaderFunction, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (fn.sourceFile === null) return false;
  return isPathWithinDir(fn.sourceFile, includeDir);
}

export function isSupportedHeaderFunction(fn: CHeaderFunction): b8 {
  return !isVariadicFunction(fn) && !isUnprototypedFunction(fn) && !hasFunctionPointerType(fn) &&
    !hasArrayReturnType(fn) && !isStaticFunction(fn) && !fn.hasBody && isTypeCIdentifier(fn.name);
}

function isVariadicFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("...");
}

function isUnprototypedFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.endsWith("()");
}

function hasFunctionPointerType(fn: CHeaderFunction): b8 {
  if (isUnsupportedPointerFunctionType(fn.returnType)) return true;
  if (fn.params.some((param) => isUnsupportedPointerFunctionType(param.type))) return true;
  return fn.functionType.includes("(*") &&
    !fn.params.some((param) => isPointerToArrayType(param.type));
}

function isUnsupportedPointerFunctionType(type: Str): b8 {
  if (!type.includes("(*")) return false;
  return !isPointerToArrayType(type);
}

function isPointerToArrayType(type: Str): b8 {
  return cPointerToArrayShape(normalizeCHeaderType(type)) !== null;
}

function hasArrayReturnType(fn: CHeaderFunction): b8 {
  return cArrayElementType(normalizeCHeaderType(fn.returnType)) !== null;
}

function isStaticFunction(fn: CHeaderFunction): b8 {
  return fn.storageClass === "static";
}
