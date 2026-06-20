import type { TypeAliasDecl, TypeRef } from "core/ast.ts";

type Str = string;

export type CTypeAliases = Map<Str, TypeAliasDecl>;

export function emitCType(
  type: TypeRef,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedCType(type.name, aliases);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
      return `${emitCType(type.element, aliases)}*`;
    case "SliceTypeRef":
      throw new Error("Slice type emission requires slice lowering");
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type without a declarator");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type without a declarator");
    case "RecordTypeRef":
      throw new Error("Record type literals must be emitted through a type alias");
  }
}

export function emitCDeclarator(
  type: TypeRef,
  name: Str,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  switch (type.kind) {
    case "InferredArrayTypeRef":
      return `${emitCType(type.element, aliases)}* ${name}`;
    case "FixedArrayTypeRef":
      return `${emitCType(type.element, aliases)} ${name}[${type.sizeText}]`;
    default:
      return `${emitCType(type, aliases)} ${name}`;
  }
}

export function emitCParamDeclarator(
  type: TypeRef,
  name: Str,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  switch (type.kind) {
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return `${emitCType(type.element, aliases)}* ${name}`;
    default:
      return `${emitCType(type, aliases)} ${name}`;
  }
}

function emitNamedCType(name: Str, aliases: CTypeAliases): Str {
  const alias = aliases.get(name);
  if (alias?.cName) return alias.cName;
  return name === "bool" ? "b8" : name;
}
