import type {
  ConditionalTypeRef,
  FixedArrayTypeRef,
  FunctionTypeRef,
  IndexedAccessTypeRef,
  InferredArrayTypeRef,
  IntersectionTypeRef,
  KeyofTypeRef,
  LiteralTypeRef,
  MappedTypeRef,
  PointerTypeRef,
  RecordField,
  RecordTypeRef,
  ReferenceTypeRef,
  SafePointerTypeRef,
  SliceTypeRef,
  TupleTypeRef,
  TypeofTypeRef,
  TypeRef,
  UnionTypeRef,
} from "core/ast.ts";
import type {
  CastConditionalTypeRef,
  CastFixedArrayTypeRef,
  CastFunctionTypeRef,
  CastIndexedAccessTypeRef,
  CastInferredArrayTypeRef,
  CastIntersectionTypeRef,
  CastKeyofTypeRef,
  CastLiteralTypeRef,
  CastMappedTypeRef,
  CastPointerTypeRef,
  CastRecordField,
  CastRecordTypeRef,
  CastReferenceTypeRef,
  CastSafePointerTypeRef,
  CastSliceTypeRef,
  CastTupleTypeRef,
  CastTypeofTypeRef,
  CastTypeRef,
  CastUnionTypeRef,
} from "core/cast.ts";
import { optionalTypeRef } from "core/optional_types.ts";

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
    case "SafePointerTypeRef":
      return lowerSafePointerTypeRef(type);
    case "SliceTypeRef":
      return lowerSliceTypeRef(type);
    case "InferredArrayTypeRef":
      return lowerInferredArrayTypeRef(type);
    case "FixedArrayTypeRef":
      return lowerFixedArrayTypeRef(type);
    case "TupleTypeRef":
      return lowerTupleTypeRef(type);
    case "UnionTypeRef":
      return lowerUnionTypeRef(type);
    case "IntersectionTypeRef":
      return lowerIntersectionTypeRef(type);
    case "ConditionalTypeRef":
      return lowerConditionalTypeRef(type);
    case "IndexedAccessTypeRef":
      return lowerIndexedAccessTypeRef(type);
    case "MappedTypeRef":
      return lowerMappedTypeRef(type);
    case "KeyofTypeRef":
      return lowerKeyofTypeRef(type);
    case "TypeofTypeRef":
      return lowerTypeofTypeRef(type);
    case "FunctionTypeRef":
      return lowerFunctionTypeRef(type);
    case "LiteralTypeRef":
      return lowerLiteralTypeRef(type);
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

function lowerSafePointerTypeRef(type: CastSafePointerTypeRef): SafePointerTypeRef {
  return { kind: "SafePointerTypeRef", element: lowerTypeRef(type.element), span: type.span };
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

function lowerTupleTypeRef(type: CastTupleTypeRef): TupleTypeRef {
  return { kind: "TupleTypeRef", elements: type.elements.map(lowerTypeRef), span: type.span };
}

function lowerUnionTypeRef(type: CastUnionTypeRef): UnionTypeRef {
  return { kind: "UnionTypeRef", members: type.members.map(lowerTypeRef), span: type.span };
}

function lowerIntersectionTypeRef(type: CastIntersectionTypeRef): IntersectionTypeRef {
  return { kind: "IntersectionTypeRef", members: type.members.map(lowerTypeRef), span: type.span };
}

function lowerConditionalTypeRef(type: CastConditionalTypeRef): ConditionalTypeRef {
  return {
    kind: "ConditionalTypeRef",
    checkType: lowerTypeRef(type.checkType),
    extendsType: lowerTypeRef(type.extendsType),
    trueType: lowerTypeRef(type.trueType),
    falseType: lowerTypeRef(type.falseType),
    span: type.span,
  };
}

function lowerIndexedAccessTypeRef(type: CastIndexedAccessTypeRef): IndexedAccessTypeRef {
  return {
    kind: "IndexedAccessTypeRef",
    objectType: lowerTypeRef(type.objectType),
    indexName: type.indexName,
    span: type.span,
  };
}

function lowerMappedTypeRef(type: CastMappedTypeRef): MappedTypeRef {
  return {
    kind: "MappedTypeRef",
    keyName: type.keyName,
    sourceType: lowerTypeRef(type.sourceType),
    valueType: lowerTypeRef(type.valueType),
    span: type.span,
  };
}

function lowerKeyofTypeRef(type: CastKeyofTypeRef): KeyofTypeRef {
  return { kind: "KeyofTypeRef", target: lowerTypeRef(type.target), span: type.span };
}

function lowerTypeofTypeRef(type: CastTypeofTypeRef): TypeofTypeRef {
  return { kind: "TypeofTypeRef", name: type.name, span: type.span };
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

function lowerLiteralTypeRef(type: CastLiteralTypeRef): LiteralTypeRef {
  return { kind: "LiteralTypeRef", value: type.value, text: type.text, span: type.span };
}

function lowerRecordTypeRef(type: CastRecordTypeRef): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: type.fields.map(lowerRecordField), span: type.span };
}

function lowerRecordField(field: CastRecordField): RecordField {
  const type = lowerTypeRef(field.type);
  return {
    name: field.name,
    type: field.optional === true ? optionalTypeRef(type) : type,
    readonly: field.readonly,
    optional: field.optional,
    span: field.span,
  };
}
