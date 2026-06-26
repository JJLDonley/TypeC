import type { TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type u32 = number;

export function tupleCTypeName(elements: TypeRef[]): Str {
  return tupleCTypeNameFromTypeNames(elements.map(typeName));
}

export function tupleCTypeNameFromTypeNames(elements: Str[]): Str {
  return `Tuple_${elements.map(encodeTupleTypePart).join("_")}`;
}

function encodeTupleTypePart(type: Str): Str {
  return [...type].map(encodeTupleTypeChar).join("") || "empty";
}

function encodeTupleTypeChar(value: Str): Str {
  if (/^[A-Za-z0-9]$/.test(value)) return value;
  const code: u32 = value.charCodeAt(0);
  return `_x${code.toString(16)}_`;
}
