import type { TypeRef } from "core/ast.ts";

type Str = string;

export const borrowedInterfaceAliasMarker: Str = "__typec_borrowed_interface";

export function borrowedInterfaceAliasType(span: TypeRef["span"]): TypeRef {
  return { kind: "NamedTypeRef", name: borrowedInterfaceAliasMarker, span };
}
