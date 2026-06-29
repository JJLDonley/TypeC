import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { optionalCTypeName } from "c/optional_names.ts";
import { recordCTypeName } from "c/records.ts";
import { sliceCTypeName } from "c/slice_names.ts";
import { tupleCTypeName } from "c/tuples.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { borrowedInterfaceAliasMarker } from "core/borrowed_interfaces.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export type CTypeAliases = Map<Str, TypeAliasDecl>;

export function emitCType(
  type: TypeRef,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedCType(type, aliases);
    case "PointerTypeRef":
    case "SafePointerTypeRef":
      return `${emitCType(type.element, aliases)}*`;
    case "ReferenceTypeRef":
      return isBorrowedInterfaceElement(type.element, aliases)
        ? emitCType(type.element, aliases)
        : `${emitCType(type.element, aliases)}*`;
    case "SliceTypeRef":
      return sliceCTypeName(type.element);
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type without a declarator");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type without a declarator");
    case "TupleTypeRef":
      return tupleCTypeName(type.elements);
    case "UnionTypeRef":
      throw new Error("Cannot emit union type sugar directly");
    case "IntersectionTypeRef":
      throw new Error("Cannot emit intersection type sugar directly");
    case "ConditionalTypeRef":
      throw new Error("Cannot emit conditional type directly");
    case "IndexedAccessTypeRef":
      throw new Error("Cannot emit indexed access type directly");
    case "MappedTypeRef":
      throw new Error("Cannot emit mapped type directly");
    case "FunctionTypeRef":
      throw new Error("Cannot emit function pointer type without a declarator");
    case "LiteralTypeRef":
      throw new Error("Cannot emit literal type directly");
    case "KeyofTypeRef":
      throw new Error("Cannot emit keyof type directly");
    case "TypeofTypeRef":
      throw new Error("Cannot emit typeof type directly");
    case "RecordTypeRef":
      return recordCTypeName(type);
  }
}

export function emitCDeclarator(
  type: TypeRef,
  name: Str,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  if (type.kind === "FixedArrayTypeRef") return emitFixedArrayCDeclarator(type, name, aliases);
  if (type.kind === "FunctionTypeRef") return emitFunctionPointerCDeclarator(type, name, aliases);
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element, aliases)}* ${name}`;
  return `${emitCType(type, aliases)} ${name}`;
}

export function emitCParamDeclarator(
  type: TypeRef,
  name: Str,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  if (type.kind === "FixedArrayTypeRef") return emitFixedArrayParamCDeclarator(type, name, aliases);
  if (type.kind === "FunctionTypeRef") return emitFunctionPointerCDeclarator(type, name, aliases);
  if (type.kind === "InferredArrayTypeRef") {
    return emitInferredArrayParamCDeclarator(type, name, aliases);
  }
  return `${emitCType(type, aliases)} ${name}`;
}

function emitFunctionPointerCDeclarator(
  type: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  name: Str,
  aliases: CTypeAliases,
): Str {
  const params = type.params.map((param) => emitCType(param.type, aliases)).join(", ");
  return `${emitCType(type.returnType, aliases)} (*${name})(${params})`;
}

function emitFunctionPointerArrayCDeclarator(
  type: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  name: Str,
  sizes: Str[],
  aliases: CTypeAliases,
): Str {
  const params = type.params.map((param) => emitCType(param.type, aliases)).join(", ");
  return `${emitCType(type.returnType, aliases)} (*${name}${arrayDimensions(sizes)})(${params})`;
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
  if (shape.element.kind === "FunctionTypeRef") {
    return emitFunctionPointerArrayCDeclarator(shape.element, name, shape.sizes, aliases);
  }
  return `${emitCType(shape.element, aliases)} ${name}${arrayDimensions(shape.sizes)}`;
}

function emitFixedArrayParamCDeclarator(
  type: Extract<TypeRef, { kind: "FixedArrayTypeRef" }>,
  name: Str,
  aliases: CTypeAliases,
): Str {
  const shape = fixedArrayShape(type);
  if (shape.element.kind === "FunctionTypeRef") {
    return emitFunctionPointerArrayParamCDeclarator(shape.element, name, shape.sizes, aliases);
  }
  if (shape.sizes.length === 1) return `${emitCType(shape.element, aliases)}* ${name}`;
  return `${emitCType(shape.element, aliases)} (*${name})${arrayDimensions(shape.sizes.slice(1))}`;
}

function emitFunctionPointerArrayParamCDeclarator(
  type: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  name: Str,
  sizes: Str[],
  aliases: CTypeAliases,
): Str {
  const params = type.params.map((param) => emitCType(param.type, aliases)).join(", ");
  const dimensions = sizes.length === 1 ? "" : arrayDimensions(sizes.slice(1));
  return `${emitCType(type.returnType, aliases)} (*${name}${dimensions})(${params})`;
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

function isBorrowedInterfaceElement(type: TypeRef, aliases: CTypeAliases): b8 {
  if (type.kind !== "NamedTypeRef") return false;
  const aliasType = aliases.get(type.name)?.type ?? null;
  return aliasType?.kind === "NamedTypeRef" && aliasType.name === borrowedInterfaceAliasMarker;
}

function emitNamedCType(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  aliases: CTypeAliases,
): Str {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) return optionalCTypeName(optionalElement);
  if (type.name === "Arena") return "__typec_arena*";
  const alias = aliases.get(type.name);
  if (alias?.cName) return alias.cName;
  return type.name === "bool" ? "b8" : type.name;
}
