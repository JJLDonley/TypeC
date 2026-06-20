import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";
import { supportedHeaderRecords } from "c/header/record_support.ts";
import { mapCHeaderRecordFieldType } from "c/header/record_field_types.ts";

type Str = string;

export function formatHeaderRecordAliases(
  records: CHeaderRecord[],
  includeDir: Str | null = null,
): Str {
  const selected = supportedHeaderRecords(selectHeaderRecords(records, includeDir));
  const recordNames = new Set<Str>(selected.map((record) => record.name));
  const aliases = selected.map((record) => formatRecord(record, recordNames));
  return `${aliases.join("\n")}${aliases.length > 0 ? "\n" : ""}`;
}

function formatRecord(record: CHeaderRecord, recordNames: Set<Str>): Str {
  const fields = record.fields.map((field) => formatRecordField(field, recordNames)).join(" ");
  return `export type ${record.name} = { ${fields} };`;
}

function formatRecordField(field: CHeaderRecordField, recordNames: Set<Str>): Str {
  return `${field.name}: ${mapCHeaderRecordFieldType(field.type, recordNames)};`;
}
