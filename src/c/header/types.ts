import { cArrayElementType } from "c/header/array_types.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { mapScalarCHeaderType } from "c/header/scalar_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderType(type: Str, recordNames: Set<Str> = new Set<Str>()): Str {
  const normalized = normalizeCHeaderType(type);
  const arrayElement = cArrayElementType(normalized);
  if (arrayElement) return `${mapCHeaderType(arrayElement, recordNames)}[]`;
  if (normalized.endsWith("*")) return `${mapCHeaderType(normalized.slice(0, -1), recordNames)}*`;
  const record = mapRecordCHeaderType(normalized, recordNames);
  if (record) return record;
  const scalar = mapScalarCHeaderType(normalized);
  if (scalar) return scalar;
  throw new TypeCError([{ message: `Unsupported C type '${type}'` }]);
}

function mapRecordCHeaderType(type: Str, recordNames: Set<Str>): Str | null {
  const name = type.startsWith("struct ") ? type.slice("struct ".length) : type;
  if (!recordNames.has(name)) return null;
  if (!isTypeCIdentifier(name)) return null;
  return name;
}
