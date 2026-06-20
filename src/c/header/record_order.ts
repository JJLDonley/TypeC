import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { mapCHeaderRecordFieldType } from "c/header/record_field_types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function orderHeaderRecordsByDependencies(records: CHeaderRecord[]): CHeaderRecord[] {
  const names = new Set<Str>(records.map((record) => record.name));
  const pending = new Map<Str, CHeaderRecord>(records.map((record) => [record.name, record]));
  const ordered: CHeaderRecord[] = [];
  while (pending.size > 0) {
    const before = pending.size;
    collectReadyRecords(pending, ordered, names);
    if (pending.size === before) return ordered;
  }
  return ordered;
}

function collectReadyRecords(
  pending: Map<Str, CHeaderRecord>,
  ordered: CHeaderRecord[],
  names: Set<Str>,
): void {
  for (const record of [...pending.values()]) {
    if (!recordDependenciesSatisfied(record, pending, names)) continue;
    pending.delete(record.name);
    ordered.push(record);
  }
}

function recordDependenciesSatisfied(
  record: CHeaderRecord,
  pending: Map<Str, CHeaderRecord>,
  names: Set<Str>,
): b8 {
  return record.fields.every((field) => fieldDependenciesSatisfied(field, pending, names));
}

function fieldDependenciesSatisfied(
  field: CHeaderRecordField,
  pending: Map<Str, CHeaderRecord>,
  names: Set<Str>,
): b8 {
  for (const dependency of fieldDependencies(field, names)) {
    if (pending.has(dependency)) return false;
  }
  return true;
}

function fieldDependencies(field: CHeaderRecordField, names: Set<Str>): Set<Str> {
  const mapped = safeMapFieldType(field, names);
  return new Set<Str>(typeParts(mapped).filter((part) => names.has(part)));
}

function safeMapFieldType(field: CHeaderRecordField, names: Set<Str>): Str {
  try {
    return mapCHeaderRecordFieldType(field.type, names);
  } catch (error) {
    if (error instanceof TypeCError) return "";
    throw error;
  }
}

function typeParts(type: Str): Str[] {
  return type.split(/[^A-Za-z0-9_.]+/).filter(nonEmptyText);
}

function nonEmptyText(text: Str): b8 {
  return text.length > 0;
}
