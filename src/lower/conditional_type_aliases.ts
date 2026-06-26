import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

export function lowerConditionalTypeAliases(typeAliases: TypeAliasDecl[]): TypeAliasDecl[] {
  const aliases: Map<Str, TypeAliasDecl> = new Map(typeAliases.map((alias) => [alias.name, alias]));
  return typeAliases.map((alias) => lowerConditionalTypeAlias(alias, aliases));
}

function lowerConditionalTypeAlias(
  alias: TypeAliasDecl,
  aliases: Map<Str, TypeAliasDecl>,
): TypeAliasDecl {
  const type: TypeRef = lowerConditionalTypeRef(alias.type, aliases);
  return type === alias.type ? alias : { ...alias, type };
}

function lowerConditionalTypeRef(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): TypeRef {
  if (type.kind !== "ConditionalTypeRef") return type;
  const selected: TypeRef = conditionMatches(type.checkType, type.extendsType, aliases)
    ? type.trueType
    : type.falseType;
  return resolveAlias(selected, aliases);
}

function conditionMatches(
  checkType: TypeRef,
  extendsType: TypeRef,
  aliases: Map<Str, TypeAliasDecl>,
): b8 {
  return typeName(resolveAlias(checkType, aliases)) ===
    typeName(resolveAlias(extendsType, aliases));
}

function resolveAlias(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): TypeRef {
  if (type.kind !== "NamedTypeRef") return type;
  const alias: TypeAliasDecl | null = aliases.get(type.name) ?? null;
  return alias?.type ?? type;
}
