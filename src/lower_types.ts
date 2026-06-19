import type {
  FixedArrayTypeRef,
  InferredArrayTypeRef,
  PointerTypeRef,
  RecordField,
  RecordTypeRef,
  ReferenceTypeRef,
  TypeRef,
} from "./ast.ts";
import type {
  CastFixedArrayTypeRef,
  CastInferredArrayTypeRef,
  CastPointerTypeRef,
  CastRecordField,
  CastRecordTypeRef,
  CastReferenceTypeRef,
  CastTypeRef,
} from "./cast.ts";

export function lowerTypeRef(type: CastTypeRef): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return { kind: "NamedTypeRef", name: type.name, span: type.span };
    case "PointerTypeRef":
      return lowerPointerTypeRef(type);
    case "ReferenceTypeRef":
      return lowerReferenceTypeRef(type);
    case "InferredArrayTypeRef":
      return lowerInferredArrayTypeRef(type);
    case "FixedArrayTypeRef":
      return lowerFixedArrayTypeRef(type);
    case "RecordTypeRef":
      return lowerRecordTypeRef(type);
  }
}

function lowerPointerTypeRef(type: CastPointerTypeRef): PointerTypeRef {
  return { kind: "PointerTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerReferenceTypeRef(type: CastReferenceTypeRef): ReferenceTypeRef {
  return { kind: "ReferenceTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerInferredArrayTypeRef(type: CastInferredArrayTypeRef): InferredArrayTypeRef {
  return { kind: "InferredArrayTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerFixedArrayTypeRef(type: CastFixedArrayTypeRef): FixedArrayTypeRef {
  return {
    kind: "FixedArrayTypeRef",
    element: lowerTypeRef(type.element),
    sizeText: type.sizeText,
    span: type.span,
  };
}

function lowerRecordTypeRef(type: CastRecordTypeRef): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: type.fields.map(lowerRecordField), span: type.span };
}

function lowerRecordField(field: CastRecordField): RecordField {
  return { name: field.name, type: lowerTypeRef(field.type), span: field.span };
}
