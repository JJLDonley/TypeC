import type { FixedArrayTypeRef, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { type CTypeAliases, emitCType } from "c/type.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function emitCTypeName(
  type: TypeAliasDecl["type"],
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  if (type.kind === "FixedArrayTypeRef") return emitFixedArrayCTypeName(type, aliases);
  if (type.kind === "InferredArrayTypeRef") return emitInferredArrayCTypeName(type, aliases);
  if (type.kind === "FunctionTypeRef") return typeName(type);
  return emitCType(type, aliases);
}

function emitInferredArrayCTypeName(
  type: Extract<TypeRef, { kind: "InferredArrayTypeRef" }>,
  aliases: CTypeAliases,
): Str {
  if (type.element.kind !== "FixedArrayTypeRef") return `${emitCType(type.element, aliases)}*`;
  return `${emitFixedArrayCTypeName(type.element, aliases)}*`;
}

function emitFixedArrayCTypeName(type: FixedArrayTypeRef, aliases: CTypeAliases): Str {
  const shape = fixedArrayShape(type);
  const element = shape.element.kind === "FunctionTypeRef"
    ? typeName(shape.element)
    : emitCType(shape.element, aliases);
  return `${element}${shape.sizes.map(arraySuffix).join("")}`;
}

type FixedArrayShape = {
  element: TypeRef;
  sizes: Str[];
};

function fixedArrayShape(type: FixedArrayTypeRef): FixedArrayShape {
  const sizes: Str[] = [];
  let element: TypeRef = type;
  while (element.kind === "FixedArrayTypeRef") {
    sizes.push(element.sizeText);
    element = element.element;
  }
  return { element, sizes };
}

function arraySuffix(size: Str): Str {
  return `[${size}]`;
}
