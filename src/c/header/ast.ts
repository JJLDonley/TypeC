import { readHeaderFunction } from "c/header/function.ts";
import { readHeaderRecord, readHeaderRecordDecl } from "c/header/records.ts";
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

export interface CHeaderConstant {
  name: Str;
  type: Str;
  value: Str;
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
  collectInner(value, (child) => collectHeaderFunctionsInto(child, functions));
}

export function collectHeaderRecords(value: unknown): CHeaderRecord[] {
  const records: CHeaderRecord[] = [];
  collectHeaderRecordsInto(value, records);
  return records;
}

export function collectHeaderConstants(value: unknown): CHeaderConstant[] {
  const constants: CHeaderConstant[] = [];
  collectHeaderConstantsInto(value, constants);
  return constants;
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
  collectInner(value, (child) => collectHeaderRecordsInto(child, records));
}

function collectHeaderConstantsInto(value: unknown, constants: CHeaderConstant[]): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "VarDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const constant = readHeaderConstant(value);
    if (constant) constants.push(constant);
  }
  collectInner(value, (child) => collectHeaderConstantsInto(child, constants));
}

function collectInner(value: JsonRecord, visit: (child: unknown) => void): void {
  const inner = value.inner;
  if (!isJsonArray(inner)) return;
  for (const child of inner) visit(child);
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return !isTruthyJsonFlag(value.isImplicit) && !isFalseJsonFlag(value.isUsed);
}

function hasName(value: JsonRecord): b8 {
  return isNonEmptyJsonText(value.name);
}

function readHeaderConstant(value: JsonRecord): CHeaderConstant | null {
  const literal = readConstantLiteral(value.inner);
  if (literal === null) return null;
  if (!isJsonRecord(value.type) || !isJsonText(value.type.qualType) || !isJsonText(value.name)) {
    return null;
  }
  return {
    name: value.name,
    type: value.type.qualType,
    value: literal,
    sourceFile: readSourceFile(value),
  };
}

function readConstantLiteral(inner: unknown): Str | null {
  if (!isJsonArray(inner)) return null;
  const literal = inner.find(isHeaderConstantLiteral);
  if (!isJsonRecord(literal) || !isJsonText(literal.value)) return null;
  return literal.value;
}

function isHeaderConstantLiteral(value: unknown): b8 {
  return isJsonRecord(value) &&
    (value.kind === "IntegerLiteral" || value.kind === "FloatingLiteral");
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

function hasType(value: JsonRecord): b8 {
  return isJsonRecord(value.type) && isJsonText(value.type.qualType);
}
