import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { optionalCTypeName } from "c/optional_names.ts";
import { type CTypeAliases, emitCType } from "c/type.ts";

type Str = string;

export function emitOptionalCType(
  element: TypeRef,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  const name = optionalCTypeName(element);
  const valueType = emitCType(element, aliases);
  return `typedef struct ${name} { b8 present; ${valueType} value; } ${name};`;
}
