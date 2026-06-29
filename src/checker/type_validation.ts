import {
  TYPE_CONDITIONAL_POSITION,
  TYPE_DUPLICATE_RECORD_FIELD,
  TYPE_INDEXED_ACCESS_POSITION,
  TYPE_INFERRED_ARRAY_FIELD,
  TYPE_INTERFACE_VALUE,
  TYPE_INTERSECTION_POSITION,
  TYPE_KEYOF_POSITION,
  TYPE_LITERAL_VALUE,
  TYPE_MAPPED_POSITION,
  TYPE_OPTIONAL_ARRAY,
  TYPE_OPTIONAL_FUNCTION,
  TYPE_OPTIONAL_VOID,
  TYPE_TYPEOF_POSITION,
  TYPE_UNINSTANTIATED_GENERIC,
  TYPE_UNION_POSITION,
  TYPE_UNKNOWN,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { RecordTypeRef, TypeRef } from "core/ast.ts";
import { isBuiltinArenaTypeName } from "checker/arenas.ts";
import { isLiteralOnlyTypeRef } from "core/literal_types.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { primitiveTypes } from "core/token.ts";
import {
  checkArrayElementType,
  checkArraySize,
  checkPointerElementType,
  checkReferenceElementType,
} from "checker/type_shapes.ts";
import { checkValueType } from "checker/value_types.ts";

type Str = string;
type b8 = boolean;
type usize = number;

type TypeValidationMode = "value" | "type-alias";

export function checkTypeRef(
  type: TypeRef,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str> = new Set<Str>(),
  mode: TypeValidationMode = "value",
): Diagnostic[] {
  switch (type.kind) {
    case "NamedTypeRef":
      return checkNamedType(type, typeAliases, interfaceNames, mode);
    case "PointerTypeRef":
      return [
        ...checkTypeRef(type.element, typeAliases, interfaceNames, mode),
        ...checkPointerElementType(type),
      ];
    case "SafePointerTypeRef":
      return [
        ...checkTypeRef(type.element, typeAliases, interfaceNames, mode),
        ...checkPointerElementType(type),
      ];
    case "ReferenceTypeRef":
      return checkReferenceType(type, typeAliases, interfaceNames, mode);
    case "SliceTypeRef":
      return checkTypeRef(type.element, typeAliases, interfaceNames, mode);
    case "FixedArrayTypeRef":
      return [
        ...checkTypeRef(type.element, typeAliases, interfaceNames, mode),
        ...checkArrayElementType(type),
        ...checkArraySize(type.sizeText, type),
      ];
    case "TupleTypeRef":
      return checkTupleType(type, typeAliases, interfaceNames, mode);
    case "UnionTypeRef":
      if (isLiteralOnlyTypeRef(type)) return checkLiteralOnlyType(type, mode);
      return [{
        message: "Union type syntax is only supported in type aliases",
        code: TYPE_UNION_POSITION,
        span: type.span,
      }];
    case "IntersectionTypeRef":
      return [{
        message: "Intersection type syntax is only supported for record type aliases",
        code: TYPE_INTERSECTION_POSITION,
        span: type.span,
      }];
    case "ConditionalTypeRef":
      return [{
        message: "Conditional type syntax is only supported in type aliases",
        code: TYPE_CONDITIONAL_POSITION,
        span: type.span,
      }];
    case "IndexedAccessTypeRef":
      return [{
        message: "Indexed access type syntax is only supported in mapped type aliases",
        code: TYPE_INDEXED_ACCESS_POSITION,
        span: type.span,
      }];
    case "MappedTypeRef":
      return [{
        message: "Mapped type syntax is only supported in type aliases",
        code: TYPE_MAPPED_POSITION,
        span: type.span,
      }];
    case "KeyofTypeRef":
      return [{
        message: "keyof type syntax is only supported in type aliases",
        code: TYPE_KEYOF_POSITION,
        span: type.span,
      }];
    case "TypeofTypeRef":
      return [{
        message: "typeof type syntax is only supported in type aliases",
        code: TYPE_TYPEOF_POSITION,
        span: type.span,
      }];
    case "FunctionTypeRef":
      return checkFunctionType(type, typeAliases, interfaceNames, mode);
    case "LiteralTypeRef":
      return checkLiteralOnlyType(type, mode);
    case "InferredArrayTypeRef":
      return [
        ...checkTypeRef(type.element, typeAliases, interfaceNames, mode),
        ...checkArrayElementType(type),
      ];
    case "RecordTypeRef":
      return checkRecordType(type, typeAliases, interfaceNames, mode);
  }
}

function checkReferenceType(
  type: Extract<TypeRef, { kind: "ReferenceTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  if (isBorrowedInterfaceType(type, interfaceNames)) return checkReferenceElementType(type);
  return [
    ...checkTypeRef(type.element, typeAliases, interfaceNames, mode),
    ...checkReferenceElementType(type),
  ];
}

function isBorrowedInterfaceType(
  type: Extract<TypeRef, { kind: "ReferenceTypeRef" }>,
  interfaceNames: Set<Str>,
): b8 {
  return type.element.kind === "NamedTypeRef" && interfaceNames.has(type.element.name);
}

function checkTupleType(
  type: Extract<TypeRef, { kind: "TupleTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const element of type.elements) {
    diagnostics.push(...checkTypeRef(element, typeAliases, interfaceNames, mode));
    diagnostics.push(
      ...checkValueType(element, "Tuple element cannot have type 'void'", element.span),
    );
  }
  return diagnostics;
}

function checkFunctionType(
  type: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const param of type.params) {
    diagnostics.push(...checkTypeRef(param.type, typeAliases, interfaceNames, mode));
  }
  diagnostics.push(...checkTypeRef(type.returnType, typeAliases, interfaceNames, mode));
  return diagnostics;
}

function checkNamedType(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) {
    return checkOptionalType(type, optionalElement, typeAliases, interfaceNames, mode);
  }
  if ((type.typeArgs ?? []).length > 0) {
    return [{
      message: `Uninstantiated generic type '${type.name}'`,
      code: TYPE_UNINSTANTIATED_GENERIC,
      span: type.span,
    }];
  }
  if (primitiveTypes.has(type.name) || isBuiltinArenaTypeName(type.name)) return [];
  const aliasType = typeAliases.get(type.name);
  if (aliasType !== undefined) return checkLiteralAlias(type, aliasType, mode);
  if (interfaceNames.has(type.name)) return [interfaceValueTypeDiagnostic(type)];
  return [{ message: `Unknown type '${type.name}'`, code: TYPE_UNKNOWN, span: type.span }];
}

function checkLiteralOnlyType(type: TypeRef, mode: TypeValidationMode): Diagnostic[] {
  if (mode === "type-alias") return [];
  return [{
    message: "Literal type cannot be used as a value type",
    code: TYPE_LITERAL_VALUE,
    span: type.span,
  }];
}

function checkLiteralAlias(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  aliasType: TypeRef,
  mode: TypeValidationMode,
): Diagnostic[] {
  if (mode === "type-alias" || !isLiteralOnlyTypeRef(aliasType)) return [];
  return [{
    message: `Literal-only type alias '${type.name}' cannot be used as a value type`,
    code: TYPE_LITERAL_VALUE,
    span: type.span,
  }];
}

function interfaceValueTypeDiagnostic(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
): Diagnostic {
  return {
    message: `Interface value type '${type.name}' is not implemented`,
    code: TYPE_INTERFACE_VALUE,
    span: type.span,
  };
}

function checkOptionalType(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  element: TypeRef,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const diagnostics = checkTypeRef(element, typeAliases, interfaceNames, mode);
  if (element.kind === "NamedTypeRef" && element.name === "void") {
    diagnostics.push({
      message: "Optional type cannot contain 'void'",
      code: TYPE_OPTIONAL_VOID,
      span: type.span,
    });
  }
  if (element.kind === "FixedArrayTypeRef" || element.kind === "InferredArrayTypeRef") {
    diagnostics.push({
      message: "Optional type cannot contain array type",
      code: TYPE_OPTIONAL_ARRAY,
      span: type.span,
    });
  }
  if (element.kind === "FunctionTypeRef") {
    diagnostics.push({
      message: "Optional type cannot contain function type",
      code: TYPE_OPTIONAL_FUNCTION,
      span: type.span,
    });
  }
  return diagnostics;
}

function checkRecordType(
  type: RecordTypeRef,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const fields = new Set<Str>();
  for (const field of type.fields) {
    diagnostics.push(...checkRecordField(field, fields, typeAliases, interfaceNames, mode));
  }
  return diagnostics;
}

function checkRecordField(
  field: RecordTypeRef["fields"][usize],
  fields: Set<Str>,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
  mode: TypeValidationMode,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (fields.has(field.name)) {
    diagnostics.push({
      message: `Duplicate field '${field.name}'`,
      code: TYPE_DUPLICATE_RECORD_FIELD,
      span: field.span,
    });
  }
  fields.add(field.name);
  diagnostics.push(...checkTypeRef(field.type, typeAliases, interfaceNames, mode));
  diagnostics.push(
    ...checkValueType(field.type, `Field '${field.name}' cannot have type 'void'`, field.span),
  );
  if (field.type.kind === "InferredArrayTypeRef") {
    diagnostics.push({
      message: `Field '${field.name}' cannot have inferred array type`,
      code: TYPE_INFERRED_ARRAY_FIELD,
      span: field.span,
    });
  }
  return diagnostics;
}
