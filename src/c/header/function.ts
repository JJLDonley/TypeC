import { readHeaderParams } from "c/header/params.ts";
import type { CHeaderFunction } from "c/header/ast.ts";
import { TypeCError } from "core/diagnostics.ts";
import { type JsonRecord, isJsonRecord } from "json/record.ts";
import { isJsonArray, isJsonText, readJsonText } from "json/values.ts";

type Str = string;
type b8 = boolean;

export function readHeaderFunction(value: JsonRecord): CHeaderFunction | null {
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
  return {
    name: value.name as Str,
    functionType,
    returnType: readReturnType(functionType),
    params: readHeaderParams(value.inner),
    sourceFile: readSourceFile(value),
    storageClass: readStorageClass(value),
    hasBody: hasFunctionBody(value),
  };
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

function isCompoundStmt(value: unknown): b8 {
  return isJsonRecord(value) && value.kind === "CompoundStmt";
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message }]);
}
