import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export type TypeAliasIndex = Map<Str, TypeAliasDecl>;

export function indexTypeAliases(typeAliases: TypeAliasDecl[]): TypeAliasIndex {
  return new Map<Str, TypeAliasDecl>(typeAliases.map((typeAlias) => [typeAlias.name, typeAlias]));
}

export function cParamShape(type: TypeRef, aliases: TypeAliasIndex): Str {
  switch (type.kind) {
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}*`;
    default:
      return cTypeShape(type, aliases);
  }
}

export function cTypeShape(type: TypeRef, aliases: TypeAliasIndex): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return aliases.get(type.name)?.cName ?? typeName(type);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
      return `${cTypeShape(type.element, aliases)}*`;
    case "SliceTypeRef":
      return `Slice<${cTypeShape(type.element, aliases)}>`;
    case "InferredArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}[]`;
    case "FixedArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}[${type.sizeText}]`;
    case "FunctionTypeRef":
      return `(${
        type.params.map((param) => `${param.name}:${cTypeShape(param.type, aliases)}`).join(",")
      })=>${cTypeShape(type.returnType, aliases)}`;
    case "RecordTypeRef":
      return recordTypeShape(type, aliases);
  }
}

function recordTypeShape(
  type: Extract<TypeRef, { kind: "RecordTypeRef" }>,
  aliases: TypeAliasIndex,
): Str {
  return `{${
    type.fields.map((field) => `${field.name}:${cTypeShape(field.type, aliases)}`).join(";")
  }}`;
}
