import type { RecordTypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type u32 = number;

export function recordCTypeName(type: RecordTypeRef): Str {
  return `Record_${encodeRecordTypePart(typeName(type))}`;
}

function encodeRecordTypePart(type: Str): Str {
  return [...type].map(encodeRecordTypeChar).join("") || "empty";
}

function encodeRecordTypeChar(value: Str): Str {
  if (/^[A-Za-z0-9]$/.test(value)) return value;
  const code: u32 = value.charCodeAt(0);
  return `_x${code.toString(16)}_`;
}
