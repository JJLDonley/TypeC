import type { TypeRef } from "core/ast.ts";

type Str = string;

export function emitCType(type: TypeRef): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedCType(type.name);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
      return `${emitCType(type.element)}*`;
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type without a declarator");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type without a declarator");
    case "RecordTypeRef":
      throw new Error("Record type literals must be emitted through a type alias");
  }
}

export function emitCDeclarator(type: TypeRef, name: Str): Str {
  switch (type.kind) {
    case "InferredArrayTypeRef":
      return `${emitCType(type.element)}* ${name}`;
    case "FixedArrayTypeRef":
      return `${emitCType(type.element)} ${name}[${type.sizeText}]`;
    default:
      return `${emitCType(type)} ${name}`;
  }
}

function emitNamedCType(name: Str): Str {
  return name === "bool" ? "b8" : name;
}
