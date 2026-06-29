import type { TypeRef } from "core/ast.ts";

type b8 = boolean;

export function isLiteralOnlyTypeRef(type: TypeRef): b8 {
  if (type.kind === "LiteralTypeRef") return true;
  if (type.kind !== "UnionTypeRef") return false;
  return type.members.length > 0 && type.members.every(isLiteralOnlyTypeRef);
}
