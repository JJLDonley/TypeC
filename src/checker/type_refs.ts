import type { TypeRef } from "core/ast.ts";
import { isBuiltinArenaTypeName } from "checker/arenas.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { primitiveTypes } from "core/token.ts";

type Str = string;
type b8 = boolean;

export function isArrayTypeRef(type: TypeRef): b8 {
  return type.kind === "FixedArrayTypeRef" || type.kind === "InferredArrayTypeRef";
}

export function isVoidValueType(type: TypeRef): b8 {
  if (isVoidNamedType(type)) return true;
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) return isVoidValueType(optionalElement);
  if (
    type.kind === "FixedArrayTypeRef" || type.kind === "InferredArrayTypeRef" ||
    type.kind === "SliceTypeRef" || type.kind === "SafePointerTypeRef"
  ) return isVoidValueType(type.element);
  if (type.kind === "TupleTypeRef") return type.elements.some(isVoidValueType);
  if (type.kind === "UnionTypeRef" || type.kind === "IntersectionTypeRef") {
    return type.members.some(isVoidValueType);
  }
  if (type.kind === "ConditionalTypeRef") {
    return isVoidValueType(type.trueType) || isVoidValueType(type.falseType);
  }
  if (type.kind === "IndexedAccessTypeRef") return isVoidValueType(type.objectType);
  if (type.kind === "MappedTypeRef") return isVoidValueType(type.valueType);
  if (type.kind === "KeyofTypeRef") return false;
  if (type.kind === "TypeofTypeRef") return false;
  if (type.kind === "LiteralTypeRef") return false;
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
    case "NamedTypeRef": {
      const optionalElement = optionalTypeElement(type);
      if (optionalElement !== null) {
        collectTypeAliasRefsInto(optionalElement, refs);
        return;
      }
      if (!primitiveTypes.has(type.name) && !isBuiltinArenaTypeName(type.name)) refs.add(type.name);
      return;
    }
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeAliasRefsInto(type.element, refs);
      return;
    case "TupleTypeRef":
      for (const element of type.elements) collectTypeAliasRefsInto(element, refs);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectTypeAliasRefsInto(member, refs);
      return;
    case "ConditionalTypeRef":
      collectTypeAliasRefsInto(type.checkType, refs);
      collectTypeAliasRefsInto(type.extendsType, refs);
      collectTypeAliasRefsInto(type.trueType, refs);
      collectTypeAliasRefsInto(type.falseType, refs);
      return;
    case "IndexedAccessTypeRef":
      collectTypeAliasRefsInto(type.objectType, refs);
      return;
    case "MappedTypeRef":
      collectTypeAliasRefsInto(type.sourceType, refs);
      collectTypeAliasRefsInto(type.valueType, refs);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeAliasRefsInto(field.type, refs);
      return;
    case "LiteralTypeRef":
    case "TypeofTypeRef":
      return;
    case "KeyofTypeRef":
      collectTypeAliasRefsInto(type.target, refs);
      return;
  }
}
