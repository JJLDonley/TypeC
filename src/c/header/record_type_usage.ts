import { cArrayElementType } from "c/header/array_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";

type Str = string;
type b8 = boolean;

export function typeUsesKnownRecord(type: Str, recordNames: Set<Str>): b8 {
  return normalizedTypeUsesKnownRecord(normalizeCHeaderType(type), recordNames);
}

function normalizedTypeUsesKnownRecord(type: Str, recordNames: Set<Str>): b8 {
  const arrayElement = cArrayElementType(type);
  if (arrayElement) return normalizedTypeUsesKnownRecord(arrayElement, recordNames);
  if (type.endsWith("*")) return normalizedTypeUsesKnownRecord(type.slice(0, -1), recordNames);
  return recordNames.has(recordName(type));
}

function recordName(type: Str): Str {
  return type.startsWith("struct ") ? type.slice("struct ".length) : type;
}
