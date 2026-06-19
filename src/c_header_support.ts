import type { CHeaderFunction } from "./c_header_ast.ts";
import { isTypeCIdentifier } from "./c_header_identifiers.ts";
import { isPathWithinDir } from "./path.ts";

type Str = string;
type b8 = boolean;

export function isIncludedHeaderFunction(fn: CHeaderFunction, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (fn.sourceFile === null) return false;
  return isPathWithinDir(fn.sourceFile, includeDir);
}

export function isSupportedHeaderFunction(fn: CHeaderFunction): b8 {
  return !isVariadicFunction(fn) && !isUnprototypedFunction(fn) && !hasFunctionPointerType(fn) && !isStaticFunction(fn) && !fn.hasBody && isTypeCIdentifier(fn.name);
}

function isVariadicFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("...");
}

function isUnprototypedFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.endsWith("()");
}

function hasFunctionPointerType(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("(*") || fn.params.some((param) => param.type.includes("(*"));
}

function isStaticFunction(fn: CHeaderFunction): b8 {
  return fn.storageClass === "static";
}
