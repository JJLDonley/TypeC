import type { CHeaderConstant, CHeaderFunction } from "c/header/ast.ts";
import { cArrayElementType } from "c/header/array_types.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { isPathWithinDir } from "paths";

type Str = string;
type b8 = boolean;

export function isIncludedHeaderFunction(fn: CHeaderFunction, includeDir: Str | null): b8 {
  return isIncludedSource(fn.sourceFile, includeDir);
}

export function isIncludedHeaderConstant(constant: CHeaderConstant, includeDir: Str | null): b8 {
  return isIncludedSource(constant.sourceFile, includeDir);
}

function isIncludedSource(sourceFile: Str | null, includeDir: Str | null): b8 {
  if (includeDir === null) return true;
  if (sourceFile === null) return false;
  return isPathWithinDir(sourceFile, includeDir);
}

export function isSupportedHeaderFunction(fn: CHeaderFunction): b8 {
  return !isUnprototypedFunction(fn) && !hasFunctionPointerReturn(fn) && !hasArrayReturnType(fn) &&
    !isStaticFunction(fn) && !fn.hasBody && isTypeCIdentifier(fn.name);
}

function isUnprototypedFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.endsWith("()");
}

function hasFunctionPointerReturn(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("(*") && !fn.params.some((param) => param.type.includes("(*"));
}

function hasArrayReturnType(fn: CHeaderFunction): b8 {
  return cArrayElementType(normalizeCHeaderType(fn.returnType)) !== null;
}

export function isSupportedHeaderConstant(constant: CHeaderConstant): b8 {
  return isTypeCIdentifier(constant.name) &&
    (isConstType(constant.type) || isGeneratedMacroType(constant.type));
}

function isStaticFunction(fn: CHeaderFunction): b8 {
  return fn.storageClass === "static";
}

function isConstType(type: Str): b8 {
  return type.includes("const");
}

function isGeneratedMacroType(type: Str): b8 {
  return type === "bool" || type === "u8*" || type === "i32" || type === "u32" ||
    type === "i64" || type === "u64" || type === "f64";
}
