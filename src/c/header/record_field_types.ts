import { cArrayType, isFixedCArraySize, isNestedCArrayType } from "c/header/array_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderRecordFieldType(type: Str, recordNames: Set<Str>): Str {
  const normalized = normalizeCHeaderType(type);
  const array = cArrayType(normalized);
  if (array === null) return mapCHeaderType(normalized, recordNames);
  if (isNestedCArrayType(normalized)) throw unsupportedRecordArrayType(type);
  if (!isFixedCArraySize(array.size)) throw unsupportedRecordArrayType(type);
  return `${mapCHeaderType(array.element, recordNames)}[${array.size}]`;
}

function unsupportedRecordArrayType(type: Str): TypeCError {
  return new TypeCError([{ message: `Unsupported C record array type '${type}'` }]);
}
