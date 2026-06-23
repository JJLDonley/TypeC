import type {
  FixedArrayTypeRef,
  FunctionTypeRef,
  InferredArrayTypeRef,
  PointerTypeRef,
  RecordField,
  RecordTypeRef,
  ReferenceTypeRef,
  SliceTypeRef,
  TypeRef,
} from "core/ast.ts";
import type {
  CastFixedArrayTypeRef,
  CastFunctionTypeRef,
  CastInferredArrayTypeRef,
  CastPointerTypeRef,
  CastRecordField,
  CastRecordTypeRef,
  CastReferenceTypeRef,
  CastSliceTypeRef,
  CastTypeRef,
} from "core/cast.ts";

export function lowerTypeRef(type: CastTypeRef): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return {
        kind: "NamedTypeRef",
        name: type.name,
        typeArgs: type.typeArgs?.map(lowerTypeRef),
        span: type.span,
      };
    case "PointerTypeRef":
      return lowerPointerTypeRef(type);
    case "ReferenceTypeRef":
      return lowerReferenceTypeRef(type);
    case "SliceTypeRef":
      return lowerSliceTypeRef(type);
    case "InferredArrayTypeRef":
      return lowerInferredArrayTypeRef(type);
    case "FixedArrayTypeRef":
      return lowerFixedArrayTypeRef(type);
    case "FunctionTypeRef":
      return lowerFunctionTypeRef(type);
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

function lowerSliceTypeRef(type: CastSliceTypeRef): SliceTypeRef {
  return { kind: "SliceTypeRef", element: lowerTypeRef(type.element), span: type.span };
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

function lowerFunctionTypeRef(type: CastFunctionTypeRef): FunctionTypeRef {
  return {
    kind: "FunctionTypeRef",
    params: type.params.map((param) => ({
      name: param.name,
      type: lowerTypeRef(param.type),
      span: param.span,
    })),
    returnType: lowerTypeRef(type.returnType),
    span: type.span,
  };
}

function lowerRecordTypeRef(type: CastRecordTypeRef): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: type.fields.map(lowerRecordField), span: type.span };
}

function lowerRecordField(field: CastRecordField): RecordField {
  return { name: field.name, type: lowerTypeRef(field.type), span: field.span };
}
