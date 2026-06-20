import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { mapCHeaderRecordFieldType } from "c/header/record_field_types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function supportedHeaderRecords(records: CHeaderRecord[]): CHeaderRecord[] {
  let supported = records;
  while (true) {
    const next = supportPass(supported);
    if (next.length === supported.length) return next;
    supported = next;
  }
}

function supportPass(records: CHeaderRecord[]): CHeaderRecord[] {
  const recordNames = new Set<Str>(records.map((record) => record.name));
  return records.filter((record) => isSupportedHeaderRecord(record, recordNames));
}

export function isSupportedHeaderRecord(record: CHeaderRecord, recordNames: Set<Str>): b8 {
  return isTypeCIdentifier(record.name) &&
    record.fields.every((field) => isSupportedHeaderRecordField(field, recordNames));
}

function isSupportedHeaderRecordField(field: CHeaderRecordField, recordNames: Set<Str>): b8 {
  if (!isTypeCIdentifier(field.name)) return false;
  try {
    mapCHeaderRecordFieldType(field.type, recordNames);
    return true;
  } catch (error) {
    if (error instanceof TypeCError) return false;
    throw error;
  }
}
