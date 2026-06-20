import type { CHeaderFunction } from "c/header/ast.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function uniqueHeaderFunctions(
  functions: CHeaderFunction[],
  recordNames: Set<Str> = new Set<Str>(),
): CHeaderFunction[] {
  const seen = new Set<Str>();
  const unique: CHeaderFunction[] = [];
  for (const fn of functions) {
    const key = headerFunctionKey(fn, recordNames);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fn);
  }
  return unique;
}

export function unambiguousHeaderFunctions(
  functions: CHeaderFunction[],
  recordNames: Set<Str> = new Set<Str>(),
): CHeaderFunction[] {
  const signatures = headerFunctionSignatures(functions, recordNames);
  return functions.filter((fn) => signatures.get(fn.name)?.size === 1);
}

export function headerFunctionTypeCSignature(
  fn: CHeaderFunction,
  recordNames: Set<Str> = new Set<Str>(),
): Str | null {
  try {
    const params = fn.params.map((param) => mapCHeaderParamSignature(param.type, recordNames)).join(
      ",",
    );
    const variadic = fn.functionType.includes("...") ? ",..." : "";
    return `${mapCHeaderType(fn.returnType, recordNames)}(${params}${variadic})`;
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function mapCHeaderParamSignature(type: Str, recordNames: Set<Str>): Str {
  const mapped = mapCHeaderType(type, recordNames);
  if (mapped.endsWith("[]")) return `${mapped.slice(0, -2)}*`;
  return mapped;
}

function headerFunctionSignatures(
  functions: CHeaderFunction[],
  recordNames: Set<Str>,
): Map<Str, Set<Str>> {
  const signatures = new Map<Str, Set<Str>>();
  for (const fn of functions) {
    const signature = headerFunctionTypeCSignature(fn, recordNames);
    if (signature === null) continue;
    const types = signatures.get(fn.name) ?? new Set<Str>();
    types.add(signature);
    signatures.set(fn.name, types);
  }
  return signatures;
}

function headerFunctionKey(fn: CHeaderFunction, recordNames: Set<Str>): Str {
  return `${fn.name}:${
    headerFunctionTypeCSignature(fn, recordNames) ?? `unsupported:${fn.functionType}`
  }`;
}
