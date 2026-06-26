import type { RecordField, RecordTypeRef, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function lowerIntersectionTypeAliases(typeAliases: TypeAliasDecl[]): TypeAliasDecl[] {
  const aliases: Map<Str, TypeAliasDecl> = new Map(typeAliases.map((alias) => [alias.name, alias]));
  return typeAliases.map((alias) => lowerIntersectionTypeAlias(alias, aliases));
}

function lowerIntersectionTypeAlias(
  alias: TypeAliasDecl,
  aliases: Map<Str, TypeAliasDecl>,
): TypeAliasDecl {
  if (alias.type.kind !== "IntersectionTypeRef") return alias;
  const record: RecordTypeRef | null = intersectionRecordType(alias.type.members, aliases);
  if (record === null) return alias;
  return { ...alias, type: { ...record, span: alias.type.span } };
}

function intersectionRecordType(
  members: TypeRef[],
  aliases: Map<Str, TypeAliasDecl>,
): RecordTypeRef | null {
  const fields: RecordField[] = [];
  for (const member of members) {
    const record: RecordTypeRef | null = memberRecordType(member, aliases);
    if (record === null) return null;
    mergeFields(fields, record.fields);
  }
  return { kind: "RecordTypeRef", fields, span: members[0]!.span };
}

function mergeFields(target: RecordField[], source: RecordField[]): void {
  for (const field of source) mergeField(target, field);
}

function mergeField(target: RecordField[], field: RecordField): void {
  const existing: RecordField | null = target.find((candidate) => candidate.name === field.name) ?? null;
  if (existing !== null && typeName(existing.type) === typeName(field.type)) return;
  target.push(field);
}

function memberRecordType(
  member: TypeRef,
  aliases: Map<Str, TypeAliasDecl>,
): RecordTypeRef | null {
  if (member.kind === "RecordTypeRef") return member;
  if (member.kind !== "NamedTypeRef") return null;
  const alias: TypeAliasDecl | null = aliases.get(member.name) ?? null;
  return alias?.type.kind === "RecordTypeRef" ? alias.type : null;
}
