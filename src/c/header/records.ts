import type { CHeaderRecord, CHeaderRecordField } from "c/header/ast.ts";
import { readHeaderJsonText } from "c/header/json_values.ts";
import {
  C_HEADER_MALFORMED_AST,
  C_HEADER_RECORD_DECLARATION,
  C_HEADER_RECORD_FIELDS,
} from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import { isJsonArray, isJsonText } from "json/values.ts";

type Str = string;
type b8 = boolean;

export function readHeaderRecord(
  value: JsonRecord,
  mainSourceFile: Str | null = null,
): CHeaderRecord | null {
  try {
    return readRecord(value, mainSourceFile);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

export function readHeaderRecordDecl(
  value: JsonRecord,
  mainSourceFile: Str | null = null,
): CHeaderRecord | null {
  try {
    return readRecordDecl(value, mainSourceFile);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readRecord(value: JsonRecord, mainSourceFile: Str | null): CHeaderRecord {
  const record = findRecordDecl(value.inner);
  if (!record) {
    throw new TypeCError([{
      message: `Typedef '${value.name}' has no record declaration`,
      code: C_HEADER_RECORD_DECLARATION,
    }]);
  }
  const fields = readRecordFields(record.inner);
  if (fields.length === 0) {
    throw new TypeCError([{
      message: `Typedef '${value.name}' has no record fields`,
      code: C_HEADER_RECORD_FIELDS,
    }]);
  }
  return {
    name: readHeaderJsonText(value.name, "Typedef has no name"),
    fields,
    sourceFile: readSourceFile(value, mainSourceFile) ?? readSourceFile(record, mainSourceFile),
  };
}

function readRecordDecl(value: JsonRecord, mainSourceFile: Str | null): CHeaderRecord {
  const fields = readRecordFields(value.inner);
  if (fields.length === 0) {
    throw new TypeCError([{
      message: `Record '${value.name}' has no fields`,
      code: C_HEADER_RECORD_FIELDS,
    }]);
  }
  return {
    name: readHeaderJsonText(value.name, "Record has no name"),
    fields,
    sourceFile: readSourceFile(value, mainSourceFile),
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
    name: readHeaderJsonText(value.name, "Field has no name"),
    type: readHeaderJsonText(type.qualType, `Field '${value.name}' has no type`),
  }];
}

function isFieldDecl(value: unknown): value is JsonRecord {
  return isJsonRecord(value) && value.kind === "FieldDecl";
}

function readSourceFile(value: JsonRecord, mainSourceFile: Str | null): Str | null {
  const loc = value.loc;
  if (!isJsonRecord(loc)) return null;
  if (isJsonText(loc.file)) return loc.file;
  if (mainSourceFile !== null && isMainFileLocation(loc)) return mainSourceFile;
  const includedFrom = loc.includedFrom;
  if (!isJsonRecord(includedFrom)) return null;
  if (isJsonText(includedFrom.file)) return includedFrom.file;
  return null;
}

function isMainFileLocation(loc: JsonRecord): b8 {
  return typeof loc.line === "number" || typeof loc.offset === "number";
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message, code: C_HEADER_MALFORMED_AST }]);
}
