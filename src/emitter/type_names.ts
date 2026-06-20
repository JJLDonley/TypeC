import type { TypeAliasDecl } from "core/ast.ts";
import { type CTypeAliases, emitCType } from "c/type.ts";

type Str = string;

export function emitCTypeName(
  type: TypeAliasDecl["type"],
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  if (type.kind === "FixedArrayTypeRef") {
    return `${emitCType(type.element, aliases)}[${type.sizeText}]`;
  }
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element, aliases)}*`;
  return emitCType(type, aliases);
}
