import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";
import { mapCHeaderType } from "c/header/types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function formatHeaderRecordAliases(
  records: CHeaderRecord[],
  includeDir: Str | null = null,
): Str {
  const selected = selectHeaderRecords(records, includeDir);
  const recordNames = new Set<Str>(selected.map((record) => record.name));
  const aliases = selected.flatMap((record) => formatSupportedRecord(record, recordNames));
  return `${aliases.join("\n")}${aliases.length > 0 ? "\n" : ""}`;
}

function formatSupportedRecord(record: CHeaderRecord, recordNames: Set<Str>): Str[] {
  try {
    if (!isSupportedHeaderRecord(record)) return [];
    return [formatRecord(record, recordNames)];
  } catch (error) {
    if (error instanceof TypeCError) return [];
    throw error;
  }
}

function formatRecord(record: CHeaderRecord, recordNames: Set<Str>): Str {
  const fields = record.fields.map((field) => formatRecordField(field, recordNames)).join(" ");
  return `export type ${record.name} = { ${fields} };`;
}

function formatRecordField(field: CHeaderRecordField, recordNames: Set<Str>): Str {
  return `${field.name}: ${mapCHeaderType(field.type, recordNames)};`;
}

function isSupportedHeaderRecord(record: CHeaderRecord): b8 {
  return isTypeCIdentifier(record.name) && record.fields.every(isSupportedHeaderRecordField);
}

function isSupportedHeaderRecordField(field: CHeaderRecordField): b8 {
  return isTypeCIdentifier(field.name);
}
