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
  const declarations = uniqueHeaderConstants(constants)
    .filter((constant) => isIncludedHeaderConstant(constant, includeDir))
    .flatMap((constant) => formatSupportedConstant(constant, recordNames));
  return `${declarations.join("\n")}${declarations.length > 0 ? "\n" : ""}`;
}

function uniqueHeaderConstants(constants: CHeaderConstant[]): CHeaderConstant[] {
  const names = new Set<Str>();
  const unique: CHeaderConstant[] = [];
  for (const constant of constants) {
    if (names.has(constant.name)) continue;
    names.add(constant.name);
    unique.push(constant);
  }
  return unique;
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
