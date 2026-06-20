import { cArrayType, isFixedCArraySize } from "c/header/array_types.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderRecordFieldType(type: Str, recordNames: Set<Str>): Str {
  const array = cArrayType(type);
  if (array === null) return mapCHeaderType(type, recordNames);
  if (!isFixedCArraySize(array.size)) throw unsupportedRecordArrayType(type);
  return `${mapCHeaderRecordFieldType(array.element, recordNames)}[${array.size}]`;
}

function unsupportedRecordArrayType(type: Str): TypeCError {
  return new TypeCError([{ message: `Unsupported C record array type '${type}'` }]);
}
