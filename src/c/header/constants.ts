import type { CHeaderConstant } from "c/header/ast.ts";
import { mapCHeaderConstantType } from "c/header/constant_types.ts";
import { isIncludedHeaderConstant, isSupportedHeaderConstant } from "c/header/support.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function formatHeaderConstants(
  constants: CHeaderConstant[],
  includeDir: Str | null = null,
  recordNames: Set<Str> = new Set<Str>(),
): Str {
  const candidates = constants.filter((constant) => isIncludedHeaderConstant(constant, includeDir));
  const declarations = uniqueHeaderConstants(
    unambiguousHeaderConstants(candidates, recordNames),
    recordNames,
  )
    .flatMap((constant) => formatSupportedConstant(constant, recordNames));
  return `${declarations.join("\n")}${declarations.length > 0 ? "\n" : ""}`;
}

function uniqueHeaderConstants(
  constants: CHeaderConstant[],
  recordNames: Set<Str>,
): CHeaderConstant[] {
  const keys = new Set<Str>();
  const unique: CHeaderConstant[] = [];
  for (const constant of constants) {
    const key = headerConstantKey(constant, recordNames);
    if (key === null || keys.has(key)) continue;
    keys.add(key);
    unique.push(constant);
  }
  return unique;
}

function unambiguousHeaderConstants(
  constants: CHeaderConstant[],
  recordNames: Set<Str>,
): CHeaderConstant[] {
  const signatures = headerConstantSignatures(constants, recordNames);
  return constants.filter((constant) => signatures.get(constant.name)?.size === 1);
}

function headerConstantSignatures(
  constants: CHeaderConstant[],
  recordNames: Set<Str>,
): Map<Str, Set<Str>> {
  const signatures = new Map<Str, Set<Str>>();
  for (const constant of constants) {
    const key = headerConstantKey(constant, recordNames);
    if (key === null) continue;
    const values = signatures.get(constant.name) ?? new Set<Str>();
    values.add(key);
    signatures.set(constant.name, values);
  }
  return signatures;
}

function headerConstantKey(constant: CHeaderConstant, recordNames: Set<Str>): Str | null {
  try {
    return `${constant.name}:${
      mapCHeaderConstantType(constant.type, recordNames)
    }=${constant.value}`;
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function formatSupportedConstant(
  constant: CHeaderConstant,
  recordNames: Set<Str>,
): Str[] {
  try {
    if (!isSupportedHeaderConstant(constant)) return [];
    return [formatConstant(constant, recordNames)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function formatConstant(constant: CHeaderConstant, recordNames: Set<Str>): Str {
  return `export const ${constant.name}: ${
    mapCHeaderConstantType(constant.type, recordNames)
  } = ${constant.value};`;
}
