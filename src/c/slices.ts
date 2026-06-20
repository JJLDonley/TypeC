import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { sliceCTypeName } from "c/slice_names.ts";
import { type CTypeAliases, emitCType } from "c/type.ts";

type Str = string;

export function emitSliceCType(
  element: TypeRef,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  const name = sliceCTypeName(element);
  const dataType = emitCType(element, aliases);
  return `typedef struct ${name} { ${dataType}* data; usize length; } ${name};`;
}
