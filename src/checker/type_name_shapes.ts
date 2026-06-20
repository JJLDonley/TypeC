import type { TypeName } from "core/tast.ts";

type b8 = boolean;
type IntLiteralValue = bigint;

export interface ArrayTypeNameShape {
  element: TypeName;
  length: IntLiteralValue | null;
}

export interface SliceTypeNameShape {
  element: TypeName;
}

export function parseArrayTypeName(type: TypeName): ArrayTypeNameShape | null {
  const match = type.match(/^(.+)\[(\d*)\]$/);
  if (!match) return null;
  return { element: match[1], length: match[2] ? BigInt(match[2]) : null };
}

export function parseSliceTypeName(type: TypeName): SliceTypeNameShape | null {
  const match = type.match(/^Slice<(.+)>$/);
  if (!match) return null;
  return { element: match[1] };
}

export function isPointerLikeTypeName(type: TypeName): b8 {
  return type.endsWith("*") || type.endsWith("&");
}

export function pointeeTypeName(type: TypeName): TypeName {
  return type.slice(0, -1);
}
