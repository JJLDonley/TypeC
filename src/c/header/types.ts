import {
  cArrayElementType,
  cArrayShape,
  cPointerToArrayShape,
  isFixedCArraySize,
  isFullyFixedCArrayType,
  isNestedCArrayType,
  typeCArrayType,
} from "c/header/array_types.ts";
import type { CPointerToArrayShape } from "c/header/array_types.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { mapScalarCHeaderType } from "c/header/scalar_types.ts";
import { normalizeCHeaderType } from "c/header/type_normalization.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

export function mapCHeaderType(type: Str, recordNames: Set<Str> = new Set<Str>()): Str {
  const normalized = normalizeCHeaderType(type);
  const functionPointer = cFunctionPointerType(normalized);
  if (functionPointer) return mapCFunctionPointerHeaderType(functionPointer, recordNames);
  const pointerArray = cPointerToArrayShape(normalized);
  if (pointerArray) return mapCPointerToArrayHeaderType(pointerArray, type, recordNames);
  const arrayElement = cArrayElementType(normalized);
  if (arrayElement) return mapCArrayHeaderType(normalized, arrayElement, type, recordNames);
  if (normalized.endsWith("*")) return `${mapCHeaderType(normalized.slice(0, -1), recordNames)}*`;
  const record = mapRecordCHeaderType(normalized, recordNames);
  if (record) return record;
  const scalar = mapScalarCHeaderType(normalized);
  if (scalar) return scalar;
  throw unsupportedCHeaderType(type);
}

interface CFunctionPointerType {
  returnType: Str;
  params: Str[];
}

function cFunctionPointerType(type: Str): CFunctionPointerType | null {
  const match = type.match(/^(.+)\(\*\)\((.*)\)$/);
  if (!match) return null;
  return { returnType: match[1].trim(), params: cFunctionPointerParams(match[2].trim()) };
}

function cFunctionPointerParams(params: Str): Str[] {
  if (params === "" || params === "void") return [];
  return params.split(",").map((param) => param.trim());
}

function mapCFunctionPointerHeaderType(type: CFunctionPointerType, recordNames: Set<Str>): Str {
  const params = type.params.map((param, index) =>
    `arg${index}: ${mapCHeaderType(param, recordNames)}`
  ).join(", ");
  return `(${params}) => ${mapCHeaderType(type.returnType, recordNames)}`;
}

function mapCPointerToArrayHeaderType(
  shape: CPointerToArrayShape,
  original: Str,
  recordNames: Set<Str>,
): Str {
  if (!shape.sizes.every(isFixedCArraySize)) throw unsupportedCHeaderType(original);
  return `Array<${typeCArrayType(mapCHeaderType(shape.base, recordNames), shape.sizes)}>`;
}

function mapCArrayHeaderType(
  normalized: Str,
  arrayElement: Str,
  original: Str,
  recordNames: Set<Str>,
): Str {
  if (!isNestedCArrayType(normalized)) return `${mapCHeaderType(arrayElement, recordNames)}[]`;
  if (!isFullyFixedCArrayType(normalized)) throw unsupportedCHeaderType(original);
  const shape = cArrayShape(normalized);
  if (shape === null) throw unsupportedCHeaderType(original);
  return typeCArrayType(mapCHeaderType(shape.base, recordNames), shape.sizes);
}

function unsupportedCHeaderType(type: Str): TypeCError {
  return new TypeCError([{ message: `Unsupported C type '${type}'` }]);
}

function mapRecordCHeaderType(type: Str, recordNames: Set<Str>): Str | null {
  const name = type.startsWith("struct ") ? type.slice("struct ".length) : type;
  if (!recordNames.has(name)) return null;
  if (!isTypeCIdentifier(name)) return null;
  return name;
}
