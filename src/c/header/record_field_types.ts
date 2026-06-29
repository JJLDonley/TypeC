import {
  cArrayShape,
  cArrayType,
  isFixedCArraySize,
  isFullyFixedCArrayType,
  isNestedCArrayType,
  typeCArrayType,
} from "c/header/array_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { C_HEADER_UNSUPPORTED_RECORD_ARRAY } from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderRecordFieldType(type: Str, recordNames: Set<Str>): Str {
  const normalized = normalizeCHeaderType(type);
  const array = cArrayType(normalized);
  if (array === null) return mapCHeaderType(normalized, recordNames);
  if (isNestedCArrayType(normalized)) {
    return mapNestedRecordArrayType(normalized, type, recordNames);
  }
  if (!isFixedCArraySize(array.size)) throw unsupportedRecordArrayType(type);
  return `${mapCHeaderType(array.element, recordNames)}[${array.size}]`;
}

function mapNestedRecordArrayType(normalized: Str, original: Str, recordNames: Set<Str>): Str {
  if (!isFullyFixedCArrayType(normalized)) throw unsupportedRecordArrayType(original);
  const shape = cArrayShape(normalized);
  if (shape === null) throw unsupportedRecordArrayType(original);
  return typeCArrayType(mapCHeaderType(shape.base, recordNames), shape.sizes);
}

function unsupportedRecordArrayType(type: Str): TypeCError {
  return new TypeCError([{
    message: `Unsupported C record array type '${type}'`,
    code: C_HEADER_UNSUPPORTED_RECORD_ARRAY,
  }]);
}
