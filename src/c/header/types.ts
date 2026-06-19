import { cArrayElementType } from "c/header/array_types.ts";
import { mapScalarCHeaderType } from "c/header/scalar_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderType(type: Str): Str {
  const normalized = normalizeCHeaderType(type);
  const arrayElement = cArrayElementType(normalized);
  if (arrayElement) return `${mapCHeaderType(arrayElement)}[]`;
  if (normalized.endsWith("*")) return `${mapCHeaderType(normalized.slice(0, -1))}*`;
  const scalar = mapScalarCHeaderType(normalized);
  if (scalar) return scalar;
  throw new TypeCError([{ message: `Unsupported C type '${type}'` }]);
}
