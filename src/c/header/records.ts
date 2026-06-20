import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import { isJsonArray, isJsonText, readJsonText } from "json/values.ts";

type Str = string;

export function readHeaderRecord(value: JsonRecord): CHeaderRecord | null {
  try {
    return readRecord(value);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

export function readHeaderRecordDecl(value: JsonRecord): CHeaderRecord | null {
  try {
    return readRecordDecl(value);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readRecord(value: JsonRecord): CHeaderRecord {
  const record = findRecordDecl(value.inner);
  if (!record) {
    throw new TypeCError([{ message: `Typedef '${value.name}' has no record declaration` }]);
  }
  const fields = readRecordFields(record.inner);
  if (fields.length === 0) {
    throw new TypeCError([{ message: `Typedef '${value.name}' has no record fields` }]);
  }
  return {
    name: readJsonText(value.name, "Typedef has no name"),
    fields,
    sourceFile: readSourceFile(value) ?? readSourceFile(record),
  };
}

function readRecordDecl(value: JsonRecord): CHeaderRecord {
  const fields = readRecordFields(value.inner);
  if (fields.length === 0) {
    throw new TypeCError([{ message: `Record '${value.name}' has no fields` }]);
  }
  return {
    name: readJsonText(value.name, "Record has no name"),
    fields,
    sourceFile: readSourceFile(value),
  };
}

function findRecordDecl(value: unknown): JsonRecord | null {
  if (!isJsonArray(value)) return null;
  for (const child of value) if (isRecordDecl(child)) return child;
  return null;
}

function isRecordDecl(value: unknown): value is JsonRecord {
  return isJsonRecord(value) && value.kind === "RecordDecl";
}

function readRecordFields(value: unknown): CHeaderRecordField[] {
  if (!isJsonArray(value)) return [];
  return value.flatMap(readRecordField);
}

function readRecordField(value: unknown): CHeaderRecordField[] {
  if (!isFieldDecl(value)) return [];
  const type = requireRecord(value.type, `Field '${value.name}' has no type`);
  return [{
    name: readJsonText(value.name, "Field has no name"),
    type: readJsonText(type.qualType, `Field '${value.name}' has no type`),
  }];
}

function isFieldDecl(value: unknown): value is JsonRecord {
  return isJsonRecord(value) && value.kind === "FieldDecl";
}

function readSourceFile(value: JsonRecord): Str | null {
  const loc = value.loc;
  if (!isJsonRecord(loc)) return null;
  if (isJsonText(loc.file)) return loc.file;
  const includedFrom = loc.includedFrom;
  if (!isJsonRecord(includedFrom)) return null;
  if (isJsonText(includedFrom.file)) return includedFrom.file;
  return null;
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message }]);
}
