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
type i32 = number;

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

export interface CHeaderEnumMember {
  name: Str;
  value: Str;
}

export interface CHeaderEnum {
  name: Str;
  members: CHeaderEnumMember[];
  sourceFile: Str | null;
}

export function collectHeaderFunctions(
  value: unknown,
  mainSourceFile: Str | null = null,
): CHeaderFunction[] {
  const functions: CHeaderFunction[] = [];
  collectHeaderFunctionsInto(value, functions, mainSourceFile);
  return functions;
}

function collectHeaderFunctionsInto(
  value: unknown,
  functions: CHeaderFunction[],
  mainSourceFile: Str | null,
): void {
  if (!isJsonRecord(value)) return;
  if (
    value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)
  ) {
    const fn = readHeaderFunction(value, mainSourceFile);
    if (fn) functions.push(fn);
  }
  collectInner(value, (child) => collectHeaderFunctionsInto(child, functions, mainSourceFile));
}

export function collectHeaderRecords(
  value: unknown,
  mainSourceFile: Str | null = null,
): CHeaderRecord[] {
  const records: CHeaderRecord[] = [];
  collectHeaderRecordsInto(value, records, mainSourceFile);
  return records;
}

export function collectHeaderConstants(
  value: unknown,
  mainSourceFile: Str | null = null,
): CHeaderConstant[] {
  const constants: CHeaderConstant[] = [];
  collectHeaderConstantsInto(value, constants, mainSourceFile);
  return constants;
}

export function collectHeaderEnums(
  value: unknown,
  mainSourceFile: Str | null = null,
): CHeaderEnum[] {
  const enums: CHeaderEnum[] = [];
  collectHeaderEnumsInto(value, enums, mainSourceFile);
  return enums;
}

function collectHeaderRecordsInto(
  value: unknown,
  records: CHeaderRecord[],
  mainSourceFile: Str | null,
): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "TypedefDecl" && hasName(value) && isHeaderDeclaration(value)) {
    const record = readHeaderRecord(value, mainSourceFile);
    if (record) records.push(record);
  }
  if (value.kind === "RecordDecl" && hasName(value) && isHeaderDeclaration(value)) {
    const record = readHeaderRecordDecl(value, mainSourceFile);
    if (record) records.push(record);
  }
  collectInner(value, (child) => collectHeaderRecordsInto(child, records, mainSourceFile));
}

function collectHeaderConstantsInto(
  value: unknown,
  constants: CHeaderConstant[],
  mainSourceFile: Str | null,
): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "VarDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const constant = readHeaderConstant(value, mainSourceFile);
    if (constant) constants.push(constant);
  }
  collectInner(value, (child) => collectHeaderConstantsInto(child, constants, mainSourceFile));
}

function collectHeaderEnumsInto(
  value: unknown,
  enums: CHeaderEnum[],
  mainSourceFile: Str | null,
): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "EnumDecl" && hasName(value) && isHeaderDeclaration(value)) {
    const enumDecl = readHeaderEnum(value, mainSourceFile);
    if (enumDecl) enums.push(enumDecl);
  }
  collectInner(value, (child) => collectHeaderEnumsInto(child, enums, mainSourceFile));
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

function readHeaderConstant(
  value: JsonRecord,
  mainSourceFile: Str | null,
): CHeaderConstant | null {
  if (!isJsonRecord(value.type) || !isJsonText(value.type.qualType) || !isJsonText(value.name)) {
    return null;
  }
  const literal = readConstantLiteral(value.inner, value.type.qualType);
  if (literal === null) return null;
  return {
    name: value.name,
    type: value.type.qualType,
    value: literal,
    sourceFile: readSourceFile(value, mainSourceFile),
  };
}

function readConstantLiteral(inner: unknown, type: Str): Str | null {
  const literal = findConstantLiteral(inner);
  if (literal === null) return null;
  if (isBoolHeaderType(type) && isIntegerLiteralText(literal)) {
    return literal === "0" ? "false" : "true";
  }
  if (isStringLiteralText(literal) && !isSimpleStringLiteralText(literal)) return null;
  return literal;
}

function findConstantLiteral(value: unknown): Str | null {
  if (isJsonArray(value)) return findSingleConstantLiteral(value);
  if (!isJsonRecord(value)) return null;
  if (isHeaderConstantLiteral(value) && isJsonText(value.value)) return value.value;
  if (!isTransparentConstantWrapper(value)) return null;
  return findSingleConstantLiteral(value.inner);
}

function findSingleConstantLiteral(inner: unknown): Str | null {
  if (!isJsonArray(inner) || inner.length !== 1) return null;
  return findConstantLiteral(inner[0]);
}

function isHeaderConstantLiteral(value: JsonRecord): b8 {
  return value.kind === "IntegerLiteral" || value.kind === "FloatingLiteral" ||
    value.kind === "StringLiteral";
}

function isTransparentConstantWrapper(value: JsonRecord): b8 {
  return value.kind === "ImplicitCastExpr" || value.kind === "ParenExpr";
}

function isBoolHeaderType(type: Str): b8 {
  return type === "const bool" || type === "const _Bool" || type === "bool" || type === "_Bool";
}

function isIntegerLiteralText(value: Str): b8 {
  return /^-?[0-9]+$/.test(value);
}

function isStringLiteralText(value: Str): b8 {
  return value.startsWith('"') && value.endsWith('"');
}

function isSimpleStringLiteralText(value: Str): b8 {
  return /^"[^"\\\r\n]*"$/.test(value);
}

function readHeaderEnum(value: JsonRecord, mainSourceFile: Str | null): CHeaderEnum | null {
  if (!isJsonText(value.name)) return null;
  const members = readHeaderEnumMembers(value.inner);
  if (members === null) return null;
  return { name: value.name, members, sourceFile: readSourceFile(value, mainSourceFile) };
}

function readHeaderEnumMembers(inner: unknown): CHeaderEnumMember[] | null {
  if (!isJsonArray(inner)) return null;
  const members: CHeaderEnumMember[] = [];
  let previous: i32 = -1;
  for (const child of inner) {
    const member = readHeaderEnumMember(child, previous);
    if (member === null) return null;
    previous = Number(member.value);
    members.push(member);
  }
  return members;
}

function readHeaderEnumMember(value: unknown, previous: i32): CHeaderEnumMember | null {
  if (!isJsonRecord(value) || value.kind !== "EnumConstantDecl" || !isJsonText(value.name)) {
    return null;
  }
  const constantValue = readHeaderEnumConstantValue(value.inner) ?? `${previous + 1}`;
  return { name: value.name, value: constantValue };
}

function readHeaderEnumConstantValue(inner: unknown): Str | null {
  if (!isJsonArray(inner) || inner.length === 0) return null;
  const value = inner[0];
  if (!isJsonRecord(value) || value.kind !== "ConstantExpr" || !isJsonText(value.value)) {
    return null;
  }
  return value.value;
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

function hasType(value: JsonRecord): b8 {
  return isJsonRecord(value.type) && isJsonText(value.type.qualType);
}
