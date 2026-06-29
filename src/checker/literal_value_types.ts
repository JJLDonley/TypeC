import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { TYPE_LITERAL_VALUE } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { isLiteralOnlyTypeRef } from "core/literal_types.ts";
import { optionalTypeElement } from "core/optional_types.ts";

export type Str = string;

export function checkTypeAliasLiteralValueTypes(
  alias: TypeAliasDecl,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  if (isLiteralOnlyTypeRef(alias.type)) return [];
  return checkLiteralValueTypes(alias.type, typeAliases);
}

function checkLiteralValueTypes(type: TypeRef, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  switch (type.kind) {
    case "LiteralTypeRef":
      return [literalValueDiagnostic(type)];
    case "NamedTypeRef":
      return checkNamedLiteralValueType(type, typeAliases);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return checkLiteralValueTypes(type.element, typeAliases);
    case "TupleTypeRef":
      return type.elements.flatMap((element) => checkLiteralValueTypes(element, typeAliases));
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      return type.members.flatMap((member) => checkLiteralValueTypes(member, typeAliases));
    case "ConditionalTypeRef":
      return [
        ...checkLiteralValueTypes(type.checkType, typeAliases),
        ...checkLiteralValueTypes(type.extendsType, typeAliases),
        ...checkLiteralValueTypes(type.trueType, typeAliases),
        ...checkLiteralValueTypes(type.falseType, typeAliases),
      ];
    case "IndexedAccessTypeRef":
      return checkLiteralValueTypes(type.objectType, typeAliases);
    case "MappedTypeRef":
      return [
        ...checkLiteralValueTypes(type.sourceType, typeAliases),
        ...checkLiteralValueTypes(type.valueType, typeAliases),
      ];
    case "KeyofTypeRef":
      return checkLiteralValueTypes(type.target, typeAliases);
    case "TypeofTypeRef":
      return [];
    case "FunctionTypeRef":
      return [
        ...type.params.flatMap((param) => checkLiteralValueTypes(param.type, typeAliases)),
        ...checkLiteralValueTypes(type.returnType, typeAliases),
      ];
    case "RecordTypeRef":
      return type.fields.flatMap((field) => checkLiteralValueTypes(field.type, typeAliases));
  }
}

function checkNamedLiteralValueType(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) return checkLiteralValueTypes(optionalElement, typeAliases);
  const aliasType = typeAliases.get(type.name);
  if (aliasType === undefined || !isLiteralOnlyTypeRef(aliasType)) return [];
  return [literalAliasValueDiagnostic(type)];
}

function literalValueDiagnostic(type: TypeRef): Diagnostic {
  return {
    message: "Literal type cannot be used as a value type",
    code: TYPE_LITERAL_VALUE,
    span: type.span,
  };
}

function literalAliasValueDiagnostic(type: Extract<TypeRef, { kind: "NamedTypeRef" }>): Diagnostic {
  return {
    message: `Literal-only type alias '${type.name}' cannot be used as a value type`,
    code: TYPE_LITERAL_VALUE,
    span: type.span,
  };
}
