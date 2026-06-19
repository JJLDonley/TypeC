import type { TypeRef } from "core/ast.ts";
import { primitiveTypes } from "core/token.ts";

type Str = string;
type b8 = boolean;

export function isCAbiType(type: TypeRef, typeAliases: Map<Str, TypeRef>): b8 {
  return isCAbiTypeSeen(type, typeAliases, new Set<Str>());
}

function isCAbiTypeSeen(type: TypeRef, typeAliases: Map<Str, TypeRef>, seen: Set<Str>): b8 {
  switch (type.kind) {
    case "NamedTypeRef":
      return isCAbiNamedType(type.name, typeAliases, seen);
    case "PointerTypeRef":
      return isCAbiTypeSeen(type.element, typeAliases, seen);
    case "RecordTypeRef":
      return type.fields.every((field) => isCAbiRecordFieldType(field.type, typeAliases, seen));
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return false;
  }
}

function isCAbiNamedType(name: Str, typeAliases: Map<Str, TypeRef>, seen: Set<Str>): b8 {
  const alias = typeAliases.get(name);
  if (!alias) return primitiveTypes.has(name);
  if (seen.has(name)) return false;
  seen.add(name);
  return isCAbiTypeSeen(alias, typeAliases, seen);
}

function isCAbiRecordFieldType(type: TypeRef, typeAliases: Map<Str, TypeRef>, seen: Set<Str>): b8 {
  if (type.kind === "FixedArrayTypeRef") return isCAbiRecordFieldType(type.element, typeAliases, seen);
  return isCAbiTypeSeen(type, typeAliases, seen);
}
