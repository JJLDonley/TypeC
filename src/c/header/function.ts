import { readHeaderJsonText } from "c/header/json_values.ts";
import { readHeaderParams } from "c/header/params.ts";
import {
  C_HEADER_MALFORMED_AST,
  C_HEADER_UNSUPPORTED_FUNCTION_TYPE,
} from "core/diagnostic_codes.ts";
import type { CHeaderFunction } from "c/header/ast.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import { isJsonArray, isJsonText } from "json/values.ts";

type Str = string;
type b8 = boolean;

export function readHeaderFunction(
  value: JsonRecord,
  mainSourceFile: Str | null = null,
): CHeaderFunction | null {
  try {
    return readFunction(value, mainSourceFile);
  } catch (error) {
    if (error instanceof TypeCError) return null;
    throw error;
  }
}

function readFunction(value: JsonRecord, mainSourceFile: Str | null): CHeaderFunction {
  const type = requireRecord(value.type, `Function '${value.name}' has no type`);
  const functionType = readHeaderJsonText(type.qualType, `Function '${value.name}' has no type`);
  return {
    name: readHeaderJsonText(value.name, "Function has no name"),
    functionType,
    returnType: readReturnType(functionType),
    params: readHeaderParams(value.inner),
    sourceFile: readSourceFile(value, mainSourceFile),
    storageClass: readStorageClass(value),
    hasBody: hasFunctionBody(value),
  };
}

function readReturnType(type: Str): Str {
  const index = type.indexOf("(");
  if (index < 0) {
    throw new TypeCError([{
      message: `Unsupported function type '${type}'`,
      code: C_HEADER_UNSUPPORTED_FUNCTION_TYPE,
    }]);
  }
  return type.slice(0, index).trim();
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
  throw new TypeCError([{ message, code: C_HEADER_MALFORMED_AST }]);
}
