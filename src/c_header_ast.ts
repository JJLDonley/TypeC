import { readHeaderParams } from "./c_header_params.ts";
import { TypeCError } from "./diagnostics.ts";
import { type JsonRecord, isJsonRecord } from "./json_record.ts";
import { isFalseJsonFlag, isJsonArray, isJsonText, isNonEmptyJsonText, isTruthyJsonFlag, readJsonText } from "./json_values.ts";

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

export function collectHeaderFunctions(value: unknown): CHeaderFunction[] {
  const functions: CHeaderFunction[] = [];
  collectHeaderFunctionsInto(value, functions);
  return functions;
}

function collectHeaderFunctionsInto(value: unknown, functions: CHeaderFunction[]): void {
  if (!isJsonRecord(value)) return;
  if (value.kind === "FunctionDecl" && hasName(value) && hasType(value) && isHeaderDeclaration(value)) {
    const fn = readSupportedFunction(value);
    if (fn) functions.push(fn);
  }
  const inner = value.inner;
  if (isJsonArray(inner)) for (const child of inner) collectHeaderFunctionsInto(child, functions);
}

function readSupportedFunction(value: JsonRecord): CHeaderFunction | null {
  try {
    return readFunction(value);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readFunction(value: JsonRecord): CHeaderFunction {
  const type = requireRecord(value.type, `Function '${value.name}' has no type`);
  const functionType = readJsonText(type.qualType, `Function '${value.name}' has no type`);
  const params = readHeaderParams(value.inner);
  return { name: value.name as Str, functionType, returnType: readReturnType(functionType), params, sourceFile: readSourceFile(value), storageClass: readStorageClass(value), hasBody: hasFunctionBody(value) };
}


function readReturnType(type: Str): Str {
  const index = type.indexOf("(");
  if (index < 0) throw new TypeCError([{ message: `Unsupported function type '${type}'` }]);
  return type.slice(0, index).trim();
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

function readStorageClass(value: JsonRecord): Str | null {
  if (isJsonText(value.storageClass)) return value.storageClass;
  return null;
}

function hasFunctionBody(value: JsonRecord): b8 {
  const inner = value.inner;
  return isJsonArray(inner) && inner.some(isCompoundStmt);
}

function isHeaderDeclaration(value: JsonRecord): b8 {
  return !isTruthyJsonFlag(value.isImplicit) && !isFalseJsonFlag(value.isUsed);
}

function isCompoundStmt(value: unknown): b8 {
  return isJsonRecord(value) && value.kind === "CompoundStmt";
}

function hasName(value: JsonRecord): b8 {
  return isNonEmptyJsonText(value.name);
}

function hasType(value: JsonRecord): b8 {
  return isJsonRecord(value.type) && isJsonText(value.type.qualType);
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message }]);
}


