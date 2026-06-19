import type { TypeRef } from "./ast.ts";

type Str = string;

export function emitCType(type: TypeRef): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedCType(type.name);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
      return `${emitCType(type.element)}*`;
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type before array checking");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type before array checking");
    case "RecordTypeRef":
      throw new Error("Record type literals must be emitted through a type alias");
  }
}

function emitNamedCType(name: Str): Str {
  return name === "bool" ? "b8" : name;
}
