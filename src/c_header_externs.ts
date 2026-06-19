import type { CHeaderFunction, CHeaderParam } from "./c_header_ast.ts";
import { mapCHeaderType } from "./c_header_types.ts";
import { uniqueHeaderFunctions, unambiguousHeaderFunctions } from "./c_header_signatures.ts";
import { isIncludedHeaderFunction, isSupportedHeaderFunction } from "./c_header_support.ts";
import { TypeCError } from "./diagnostics.ts";

type Str = string;

export function formatHeaderExterns(functions: CHeaderFunction[], includeDir: Str | null = null): Str {
  const candidates = functions.filter((fn) => isIncludedHeaderFunction(fn, includeDir));
  const externs = uniqueHeaderFunctions(unambiguousHeaderFunctions(candidates)).flatMap(formatSupportedFunction);
  return `${externs.join("\n")}${externs.length > 0 ? "\n" : ""}`;
}

function formatSupportedFunction(fn: CHeaderFunction): Str[] {
  try {
    if (!isSupportedHeaderFunction(fn)) return [];
    return [formatFunction(fn)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function formatFunction(fn: CHeaderFunction): Str {
  const params = fn.params.map(formatParam).join(", ");
  return `extern function ${fn.name}(${params}): ${mapCHeaderType(fn.returnType)};`;
}

function formatParam(param: CHeaderParam): Str {
  return `${param.name}: ${mapCHeaderType(param.type)}`;
}
