import type { Diagnostic } from "core/diagnostics.ts";
import type { RecordTypeRef, TypeRef } from "core/ast.ts";
import { isBuiltinArenaTypeName } from "checker/arenas.ts";
import { primitiveTypes } from "core/token.ts";
import {
  checkArrayElementType,
  checkArraySize,
  checkPointerElementType,
  checkReferenceElementType,
} from "checker/type_shapes.ts";
import { checkValueType } from "checker/value_types.ts";

type Str = string;
type usize = number;

export function checkTypeRef(type: TypeRef, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  switch (type.kind) {
    case "NamedTypeRef":
      return checkNamedType(type, typeAliases);
    case "PointerTypeRef":
      return [...checkTypeRef(type.element, typeAliases), ...checkPointerElementType(type)];
    case "SafePointerTypeRef":
      return [...checkTypeRef(type.element, typeAliases), ...checkPointerElementType(type)];
    case "ReferenceTypeRef":
      return [...checkTypeRef(type.element, typeAliases), ...checkReferenceElementType(type)];
    case "SliceTypeRef":
      return checkTypeRef(type.element, typeAliases);
    case "FixedArrayTypeRef":
      return [
        ...checkTypeRef(type.element, typeAliases),
        ...checkArrayElementType(type),
        ...checkArraySize(type.sizeText, type),
      ];
    case "FunctionTypeRef":
      return checkFunctionType(type, typeAliases);
    case "InferredArrayTypeRef":
      return [...checkTypeRef(type.element, typeAliases), ...checkArrayElementType(type)];
    case "RecordTypeRef":
      return checkRecordType(type, typeAliases);
  }
}

function checkFunctionType(
  type: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const param of type.params) diagnostics.push(...checkTypeRef(param.type, typeAliases));
  diagnostics.push(...checkTypeRef(type.returnType, typeAliases));
  return diagnostics;
}

function checkNamedType(
  type: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  if ((type.typeArgs ?? []).length > 0) {
    return [{ message: `Uninstantiated generic type '${type.name}'`, span: type.span }];
  }
  if (
    primitiveTypes.has(type.name) || isBuiltinArenaTypeName(type.name) || typeAliases.has(type.name)
  ) {
    return [];
  }
  return [{ message: `Unknown type '${type.name}'`, span: type.span }];
}

function checkRecordType(type: RecordTypeRef, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const fields = new Set<Str>();
  for (const field of type.fields) {
    diagnostics.push(...checkRecordField(field, fields, typeAliases));
  }
  return diagnostics;
}

function checkRecordField(
  field: RecordTypeRef["fields"][usize],
  fields: Set<Str>,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (fields.has(field.name)) {
    diagnostics.push({ message: `Duplicate field '${field.name}'`, span: field.span });
  }
  fields.add(field.name);
  diagnostics.push(...checkTypeRef(field.type, typeAliases));
  diagnostics.push(
    ...checkValueType(field.type, `Field '${field.name}' cannot have type 'void'`, field.span),
  );
  if (field.type.kind === "InferredArrayTypeRef") {
    diagnostics.push({
      message: `Field '${field.name}' cannot have inferred array type`,
      span: field.span,
    });
  }
  return diagnostics;
}
