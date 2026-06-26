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
    case "SafePointerTypeRef":
      return isCAbiTypeSeen(type.element, typeAliases, seen);
    case "RecordTypeRef":
      return type.fields.every((field) => isCAbiRecordFieldType(field.type, typeAliases, seen));
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return isCAbiTypeSeen(type.element, typeAliases, seen);
    case "FunctionTypeRef":
      return type.params.every((param) => isCAbiTypeSeen(param.type, typeAliases, seen)) &&
        isCAbiTypeSeen(type.returnType, typeAliases, seen);
    case "TupleTypeRef":
      return type.elements.every((element) => isCAbiTypeSeen(element, typeAliases, seen));
    case "ReferenceTypeRef":
    case "SliceTypeRef":
    case "UnionTypeRef":
    case "IntersectionTypeRef":
    case "ConditionalTypeRef":
    case "IndexedAccessTypeRef":
    case "MappedTypeRef":
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
  if (type.kind === "FixedArrayTypeRef") {
    return isCAbiRecordFieldType(type.element, typeAliases, seen);
  }
  return isCAbiTypeSeen(type, typeAliases, seen);
}
