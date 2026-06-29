import type { CHeaderParam } from "c/header/ast.ts";
import { C_HEADER_MALFORMED_AST } from "core/diagnostic_codes.ts";
import { sanitizeHeaderParamName, uniqueHeaderParamName } from "c/header/identifiers.ts";
import { readHeaderJsonText } from "c/header/json_values.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import { isJsonArray, isNonEmptyJsonText } from "json/values.ts";

type Str = string;
type usize = number;

export function readHeaderParams(value: unknown): CHeaderParam[] {
  if (!isJsonArray(value)) return [];
  const params: CHeaderParam[] = [];
  const names = new Set<Str>();
  for (const child of value) {
    if (isParam(child)) params.push(readParam(child, params.length, names));
  }
  return params;
}

function readParam(value: JsonRecord, index: usize, names: Set<Str>): CHeaderParam {
  const type = requireRecord(value.type, "Parameter has no type");
  return {
    name: readParamName(value, index, names),
    type: readHeaderJsonText(type.qualType, "Parameter has no type"),
  };
}

function readParamName(value: JsonRecord, index: usize, names: Set<Str>): Str {
  const candidate = isNonEmptyJsonText(value.name)
    ? sanitizeHeaderParamName(value.name)
    : `arg${index}`;
  return uniqueHeaderParamName(candidate, names);
}

function isParam(value: unknown): value is JsonRecord {
  return isJsonRecord(value) && value.kind === "ParmVarDecl";
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message, code: C_HEADER_MALFORMED_AST }]);
}
