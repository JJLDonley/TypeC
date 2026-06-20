import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { sliceCTypeName } from "c/slice_names.ts";

type Str = string;
type usize = number;

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
      return sliceCTypeName(type.element);
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
  if (type.kind === "FixedArrayTypeRef") return emitFixedArrayCDeclarator(type, name, aliases);
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element, aliases)}* ${name}`;
  return `${emitCType(type, aliases)} ${name}`;
}

export function emitCParamDeclarator(
  type: TypeRef,
  name: Str,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  if (type.kind === "FixedArrayTypeRef") return emitFixedArrayParamCDeclarator(type, name, aliases);
  if (type.kind === "InferredArrayTypeRef") {
    return emitInferredArrayParamCDeclarator(type, name, aliases);
  }
  return `${emitCType(type, aliases)} ${name}`;
}

function emitInferredArrayParamCDeclarator(
  type: Extract<TypeRef, { kind: "InferredArrayTypeRef" }>,
  name: Str,
  aliases: CTypeAliases,
): Str {
  if (type.element.kind !== "FixedArrayTypeRef") {
    return `${emitCType(type.element, aliases)}* ${name}`;
  }
  const shape = fixedArrayShape(type.element);
  return `${emitCType(shape.element, aliases)} (*${name})${arrayDimensions(shape.sizes)}`;
}

function emitFixedArrayCDeclarator(
  type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>,
  name: Str,
  aliases: CTypeAliases,
): Str {
  const shape = fixedArrayShape(type);
  return `${emitCType(shape.element, aliases)} ${name}${arrayDimensions(shape.sizes)}`;
}

function emitFixedArrayParamCDeclarator(
  type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>,
  name: Str,
  aliases: CTypeAliases,
): Str {
  const shape = fixedArrayShape(type);
  if (shape.sizes.length === 1) return `${emitCType(shape.element, aliases)}* ${name}`;
  return `${emitCType(shape.element, aliases)} (*${name})${arrayDimensions(shape.sizes.slice(1))}`;
}

type FixedArrayShape = {
  element: TypeRef;
  sizes: Str[];
};

function fixedArrayShape(type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>): FixedArrayShape {
  const sizes: Str[] = [];
  let element: TypeRef = type;
  while (element.kind === "FixedArrayTypeRef") {
    sizes.push(element.sizeText);
    element = element.element;
  }
  return { element, sizes };
}

function arrayDimensions(sizes: Str[]): Str {
  return sizes.map(arrayDimension).join("");
}

function arrayDimension(size: Str, _index: usize): Str {
  return `[${size}]`;
}

function emitNamedCType(name: Str, aliases: CTypeAliases): Str {
  const alias = aliases.get(name);
  if (alias?.cName) return alias.cName;
  return name === "bool" ? "b8" : name;
}
