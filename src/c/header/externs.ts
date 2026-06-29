import type { CHeaderFunction, CHeaderParam } from "c/header/ast.ts";
import { typeUsesKnownRecord } from "c/header/record_type_usage.ts";
import { unambiguousHeaderFunctions, uniqueHeaderFunctions } from "c/header/signatures.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { isIncludedHeaderFunction, isSupportedHeaderFunction } from "c/header/support.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function formatHeaderExterns(
  functions: CHeaderFunction[],
  includeDir: Str | null = null,
  recordNames: Set<Str> = new Set<Str>(),
): Str {
  const candidates = functions.filter((fn) =>
    isIncludedHeaderFunction(fn, includeDir) ||
    isUnlocatedKnownRecordFunction(fn, includeDir, recordNames)
  );
  const externs = uniqueHeaderFunctions(
    unambiguousHeaderFunctions(candidates, recordNames),
    recordNames,
  ).flatMap((fn) => formatSupportedFunction(fn, recordNames));
  return `${externs.join("\n")}${externs.length > 0 ? "\n" : ""}`;
}

function isUnlocatedKnownRecordFunction(
  fn: CHeaderFunction,
  includeDir: Str | null,
  recordNames: Set<Str>,
): b8 {
  return includeDir !== null && fn.sourceFile === null && fnUsesKnownRecord(fn, recordNames);
}

function fnUsesKnownRecord(fn: CHeaderFunction, recordNames: Set<Str>): b8 {
  return typeUsesKnownRecord(fn.returnType, recordNames) ||
    fn.params.some((param) => typeUsesKnownRecord(param.type, recordNames));
}

function formatSupportedFunction(fn: CHeaderFunction, recordNames: Set<Str>): Str[] {
  try {
    if (!isSupportedHeaderFunction(fn)) return [];
    return [formatFunction(fn, recordNames)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function formatFunction(fn: CHeaderFunction, recordNames: Set<Str>): Str {
  const params = formatParams(fn, recordNames);
  return `export extern function ${fn.name}(${params}): ${
    mapCHeaderType(fn.returnType, recordNames)
  };`;
}

function formatParams(fn: CHeaderFunction, recordNames: Set<Str>): Str {
  const params = fn.params.map((param) => formatParam(param, recordNames));
  if (isVariadicFunction(fn)) params.push("...args");
  return params.join(", ");
}

function isVariadicFunction(fn: CHeaderFunction): b8 {
  return fn.functionType.includes("...");
}

function formatParam(param: CHeaderParam, recordNames: Set<Str>): Str {
  return `${param.name}: ${mapCHeaderType(param.type, recordNames)}`;
}
