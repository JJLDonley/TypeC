import type {
  MappedTypeRef,
  RecordField,
  RecordTypeRef,
  TypeAliasDecl,
  TypeRef,
} from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

export function lowerMappedTypeAliases(typeAliases: TypeAliasDecl[]): TypeAliasDecl[] {
  const aliases: Map<Str, TypeAliasDecl> = new Map(typeAliases.map((alias) => [alias.name, alias]));
  return typeAliases.map((alias) => lowerMappedTypeAlias(alias, aliases));
}

function lowerMappedTypeAlias(
  alias: TypeAliasDecl,
  aliases: Map<Str, TypeAliasDecl>,
): TypeAliasDecl {
  if (alias.type.kind !== "MappedTypeRef") return alias;
  const record: RecordTypeRef | null = mappedRecordType(alias.type, aliases);
  if (record === null) return alias;
  return { ...alias, type: { ...record, span: alias.type.span } };
}

function mappedRecordType(
  type: MappedTypeRef,
  aliases: Map<Str, TypeAliasDecl>,
): RecordTypeRef | null {
  const source: RecordTypeRef | null = sourceRecordType(type.sourceType, aliases);
  if (source === null) return null;
  return {
    kind: "RecordTypeRef",
    fields: source.fields.map((field) => mappedRecordField(field, type, aliases)),
    span: type.span,
  };
}

function mappedRecordField(
  field: RecordField,
  type: MappedTypeRef,
  aliases: Map<Str, TypeAliasDecl>,
): RecordField {
  return { ...field, type: mappedValueType(field, type, aliases) };
}

function mappedValueType(
  field: RecordField,
  type: MappedTypeRef,
  aliases: Map<Str, TypeAliasDecl>,
): TypeRef {
  if (!isSourceIndexedAccess(type.valueType, type)) return type.valueType;
  const sourceField: RecordField | null = sourceFieldByName(type.sourceType, field.name, aliases);
  return sourceField?.type ?? type.valueType;
}

function isSourceIndexedAccess(valueType: TypeRef, mappedType: MappedTypeRef): b8 {
  return valueType.kind === "IndexedAccessTypeRef" &&
    valueType.indexName === mappedType.keyName &&
    typeName(valueType.objectType) === typeName(mappedType.sourceType);
}

function sourceFieldByName(
  sourceType: TypeRef,
  name: Str,
  aliases: Map<Str, TypeAliasDecl>,
): RecordField | null {
  const source: RecordTypeRef | null = sourceRecordType(sourceType, aliases);
  return source?.fields.find((field) => field.name === name) ?? null;
}

function sourceRecordType(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): RecordTypeRef | null {
  const resolved: TypeRef = resolveAlias(type, aliases);
  return resolved.kind === "RecordTypeRef" ? resolved : null;
}

function resolveAlias(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): TypeRef {
  if (type.kind !== "NamedTypeRef") return type;
  const alias: TypeAliasDecl | null = aliases.get(type.name) ?? null;
  return alias?.type ?? type;
}
