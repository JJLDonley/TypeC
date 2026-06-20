import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function uniqueCompatibleHeaderRecords(records: CHeaderRecord[]): CHeaderRecord[] {
  const recordNames = new Set<Str>(records.map((record) => record.name));
  return [...groupHeaderRecords(records).values()].flatMap((group) =>
    selectCompatibleRecord(group, recordNames)
  );
}

function groupHeaderRecords(records: CHeaderRecord[]): Map<Str, CHeaderRecord[]> {
  const groups = new Map<Str, CHeaderRecord[]>();
  for (const record of records) {
    groups.set(record.name, [...(groups.get(record.name) ?? []), record]);
  }
  return groups;
}

function selectCompatibleRecord(records: CHeaderRecord[], recordNames: Set<Str>): CHeaderRecord[] {
  if (records.length === 0) return [];
  if (!records.every((record) => sameRecord(record, records[0], recordNames))) return [];
  return [records[0]];
}

function sameRecord(
  left: CHeaderRecord,
  right: CHeaderRecord | undefined,
  recordNames: Set<Str>,
): b8 {
  if (!right) return false;
  if (left.fields.length !== right.fields.length) return false;
  return left.fields.every((field, index) => sameField(field, right.fields[index], recordNames));
}

function sameField(
  left: CHeaderRecordField,
  right: CHeaderRecordField | undefined,
  recordNames: Set<Str>,
): b8 {
  return right !== undefined && left.name === right.name &&
    fieldTypeShape(left, recordNames) === fieldTypeShape(right, recordNames);
}

function fieldTypeShape(field: CHeaderRecordField, recordNames: Set<Str>): Str {
  try {
    return mapCHeaderType(field.type, recordNames);
  } catch (error) {
    if (error instanceof TypeCError) return `unsupported:${field.type}`;
    throw error;
  }
}
