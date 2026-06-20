import { readHeaderFunction } from "c/header/function.ts";
import { readHeaderRecord, readHeaderRecordDecl } from "c/header/records.ts";
import { uniqueCompatibleHeaderRecords } from "c/header/record_uniqueness.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import {
  isFalseJsonFlag,
  isJsonArray,
  isJsonText,
  isNonEmptyJsonText,
  isTruthyJsonFlag,
} from "json/values.ts";

type Str = string;
type b8 = boolean;

export interface CHeaderParam {
  name: Str;
  type: Str;
}

export interface CHeaderFunction {
  name: Str;
  functionType: Str;
  returnType: Str;
  params: CHeaderParam[];
  sourceFile: Str | null;
  storageClass: Str | null;
  hasBody: b8;
}

export interface CHeaderRecordField {
  name: Str;
  type: Str;
}

export interface CHeaderRecord {
  name: Str;
  fields: CHeaderRecordField[];
  sourceFile: Str | null;
}

export function collectHeaderFunctions(value: unknown): CHeaderFunction[] {
  const functions: CHeaderFunction[] = [];
  collectHeaderFunctionsInto(value, functions);
  return functions;
}

function collectHeaderFunctionsInto(value: unknown, functions: CHeaderFunction[]): void {
  if (!isJsonRecord(value)) return;
  if (
    value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)
  ) {
    const fn = readHeaderFunction(value);
    if (fn) functions.push(fn);
  }
  const inner = value.inner;
  if (isJsonArray(inner)) {
    for (const child of inner) {
      collectHeaderFunctionsInto(child, functions);
    }
  }
}

export function collectHeaderRecords(value: unknown): CHeaderRecord[] {
  const records: CHeaderRecord[] = [];
  collectHeaderRecordsInto(value, records);
  return uniqueCompatibleHeaderRecords(records);
}

function collectHeaderRecordsInto(value: unknown, records: CHeaderRecord[]): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "TypedefDecl" && hasName(value) && isHeaderDeclaration(value)) {
    const record = readHeaderRecord(value);
    if (record) records.push(record);
  }
  if (value.kind === "RecordDecl" && hasName(value) && isHeaderDeclaration(value)) {
    const record = readHeaderRecordDecl(value);
    if (record) records.push(record);
  }
  const inner = value.inner;
  if (isJsonArray(inner)) { for (const child of inner) collectHeaderRecordsInto(child, records); }
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return !isTruthyJsonFlag(value.isImplicit) && !isFalseJsonFlag(value.isUsed);
}

function hasName(value: JsonRecord): b8 {
  return isNonEmptyJsonText(value.name);
}

function hasType(value: JsonRecord): b8 {
  return isJsonRecord(value.type) && isJsonText(value.type.qualType);
}
