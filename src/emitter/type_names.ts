import type { TypeAliasDecl } from "core/ast.ts";
import { emitCType } from "c/type.ts";

type Str = string;

export function emitCTypeName(type: TypeAliasDecl["type"]): Str {
  if (type.kind === "FixedArrayTypeRef") return `${emitCType(type.element)}[${type.sizeText}]`;
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}*`;
  return emitCType(type);
}
