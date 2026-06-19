import type { CHeaderFunction } from "./c_header_ast.ts";
import { mapCHeaderType } from "./c_header_types.ts";
import { TypeCError } from "./diagnostics.ts";

type Str = string;

export function uniqueHeaderFunctions(functions: CHeaderFunction[]): CHeaderFunction[] {
  const seen = new Set<Str>();
  const unique: CHeaderFunction[] = [];
  for (const fn of functions) {
    const key = headerFunctionKey(fn);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fn);
  }
  return unique;
}

export function unambiguousHeaderFunctions(functions: CHeaderFunction[]): CHeaderFunction[] {
  const signatures = headerFunctionSignatures(functions);
  return functions.filter((fn) => signatures.get(fn.name)?.size === 1);
}

export function headerFunctionTypeCSignature(fn: CHeaderFunction): Str | null {
  try {
    const params = fn.params.map((param) => mapCHeaderType(param.type)).join(",");
    return `${mapCHeaderType(fn.returnType)}(${params})`;
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function headerFunctionSignatures(functions: CHeaderFunction[]): Map<Str, Set<Str>> {
  const signatures = new Map<Str, Set<Str>>();
  for (const fn of functions) {
    const signature = headerFunctionTypeCSignature(fn);
    if (signature === null) continue;
    const types = signatures.get(fn.name) ?? new Set<Str>();
    types.add(signature);
    signatures.set(fn.name, types);
  }
  return signatures;
}

function headerFunctionKey(fn: CHeaderFunction): Str {
  return `${fn.name}:${headerFunctionTypeCSignature(fn) ?? `unsupported:${fn.functionType}`}`;
}
