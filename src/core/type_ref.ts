import type { TypeRef } from "core/ast.ts";

type Str = string;
type b8 = boolean;

export function typeName(type: TypeRef): Str {
  switch (type.kind) {
    case "NamedTypeRef": {
      const args = type.typeArgs?.map(typeName).join(", ") ?? "";
      return args.length > 0 ? `${type.name}<${args}>` : type.name;
    }
    case "PointerTypeRef":
      return `${typeName(type.element)}*`;
    case "ReferenceTypeRef":
      return `${typeName(type.element)}&`;
    case "SliceTypeRef":
      return `Slice<${typeName(type.element)}>`;
    case "InferredArrayTypeRef":
      return `${typeName(type.element)}[]`;
    case "FixedArrayTypeRef":
      return `${typeName(type.element)}[${type.sizeText}]`;
    case "FunctionTypeRef":
      return `(${
        type.params.map((param) => `${param.name}: ${typeName(param.type)}`).join(", ")
      }) => ${typeName(type.returnType)}`;
    case "RecordTypeRef":
      return `{${type.fields.map((field) => `${field.name}:${typeName(field.type)}`).join(";")}}`;
  }
}

export function isNamedType(type: TypeRef): type is Extract<TypeRef, { kind: "NamedTypeRef" }> {
  return type.kind === "NamedTypeRef";
}
