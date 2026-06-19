import type { CHeaderParam } from "./c_header_ast.ts";
import { sanitizeHeaderParamName, uniqueHeaderParamName } from "./c_header_identifiers.ts";
import { TypeCError } from "./diagnostics.ts";
import { type JsonRecord, isJsonRecord } from "./json_record.ts";
import { isJsonArray, isNonEmptyJsonText, readJsonText } from "./json_values.ts";

type Str = string;
type usize = number;

export function readHeaderParams(value: unknown): CHeaderParam[] {
  if (!isJsonArray(value)) return [];
  const params: CHeaderParam[] = [];
  const names = new Set<Str>();
  for (const child of value) if (isParam(child)) params.push(readParam(child, params.length, names));
  return params;
}

function readParam(value: JsonRecord, index: usize, names: Set<Str>): CHeaderParam {
  const type = requireRecord(value.type, "Parameter has no type");
  return { name: readParamName(value, index, names), type: readJsonText(type.qualType, "Parameter has no type") };
}

function readParamName(value: JsonRecord, index: usize, names: Set<Str>): Str {
  const candidate = isNonEmptyJsonText(value.name) ? sanitizeHeaderParamName(value.name) : `arg${index}`;
  return uniqueHeaderParamName(candidate, names);
}

function isParam(value: unknown): value is JsonRecord {
  return isJsonRecord(value) && value.kind === "ParmVarDecl";
}

function requireRecord(value: unknown, message: Str): JsonRecord {
  if (isJsonRecord(value)) return value;
  throw new TypeCError([{ message }]);
}
