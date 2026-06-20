import { cArrayShape, isFixedCArraySize, typeCArrayType } from "c/header/array_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { mapCHeaderType } from "c/header/types.ts";

type Str = string;

export function mapCHeaderConstantType(
  type: Str,
  recordNames: Set<Str> = new Set<Str>(),
): Str {
  const normalized = normalizeCHeaderType(type);
  const array = cArrayShape(normalized);
  if (array === null) return mapCHeaderType(type, recordNames);
  if (!array.sizes.every(isFixedCArraySize)) return mapCHeaderType(type, recordNames);
  return typeCArrayType(mapCHeaderType(array.base, recordNames), array.sizes);
}
