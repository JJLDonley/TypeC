import type { TypeRef } from "core/ast.ts";
import { isBuiltinArenaTypeName } from "checker/arenas.ts";
import { primitiveTypes } from "core/token.ts";

type Str = string;
type b8 = boolean;

export function isArrayTypeRef(type: TypeRef): b8 {
  return type.kind === "FixedArrayTypeRef" || type.kind === "InferredArrayTypeRef";
}

export function isVoidValueType(type: TypeRef): b8 {
  if (isVoidNamedType(type)) return true;
  if (
    type.kind === "FixedArrayTypeRef" || type.kind === "InferredArrayTypeRef" ||
    type.kind === "SliceTypeRef" || type.kind === "SafePointerTypeRef"
  ) return isVoidValueType(type.element);
  return false;
}

export function isVoidNamedType(type: TypeRef): b8 {
  return type.kind === "NamedTypeRef" && type.name === "void";
}

export function collectTypeAliasRefs(type: TypeRef): Set<Str> {
  const refs = new Set<Str>();
  collectTypeAliasRefsInto(type, refs);
  return refs;
}

function collectTypeAliasRefsInto(type: TypeRef, refs: Set<Str>): void {
  switch (type.kind) {
    case "NamedTypeRef":
      if (!primitiveTypes.has(type.name) && !isBuiltinArenaTypeName(type.name)) refs.add(type.name);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeAliasRefsInto(type.element, refs);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeAliasRefsInto(field.type, refs);
      return;
  }
}
