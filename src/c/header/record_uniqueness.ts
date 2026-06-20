import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function uniqueCompatibleHeaderRecords(records: CHeaderRecord[]): CHeaderRecord[] {
  return [...groupHeaderRecords(records).values()].flatMap(selectCompatibleRecord);
}

function groupHeaderRecords(records: CHeaderRecord[]): Map<Str, CHeaderRecord[]> {
  const groups = new Map<Str, CHeaderRecord[]>();
  for (const record of records) {
    groups.set(record.name, [...(groups.get(record.name) ?? []), record]);
  }
  return groups;
}

function selectCompatibleRecord(records: CHeaderRecord[]): CHeaderRecord[] {
  if (records.length === 0) return [];
  if (!records.every((record) => sameRecord(record, records[0]))) return [];
  return [records[0]];
}

function sameRecord(left: CHeaderRecord, right: CHeaderRecord | undefined): b8 {
  if (!right) return false;
  if (left.fields.length !== right.fields.length) return false;
  return left.fields.every((field, index) => sameField(field, right.fields[index]));
}

function sameField(left: CHeaderRecordField, right: CHeaderRecordField | undefined): b8 {
  return right !== undefined && left.name === right.name && left.type === right.type;
}
