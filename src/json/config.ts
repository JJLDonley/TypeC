import { JSON_INVALID, JSON_RECORD_REQUIRED, JSON_UNKNOWN_KEY } from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";

type Str = string;

export function parseJsonRecord(
  text: Str,
  invalidJsonMessage: Str,
  nonRecordMessage: Str,
  invalidJsonCode: Str = JSON_INVALID,
  nonRecordCode: Str = JSON_RECORD_REQUIRED,
): JsonRecord {
  const value = parseJson(text, invalidJsonMessage, invalidJsonCode);
  if (!isJsonRecord(value)) throw jsonConfigError(nonRecordMessage, nonRecordCode);
  return value;
}

export function rejectUnknownJsonKeys(
  scope: Str,
  value: JsonRecord,
  knownKeys: Str[],
  code: Str = JSON_UNKNOWN_KEY,
): void {
  const known = new Set<Str>(knownKeys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw jsonConfigError(`${scope} has unknown key '${key}'`, code);
  }
}

export function jsonConfigError(message: Str, code: Str = JSON_RECORD_REQUIRED): TypeCError {
  return new TypeCError([{ message, code }]);
}

function parseJson(text: Str, invalidJsonMessage: Str, invalidJsonCode: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw jsonConfigError(invalidJsonMessage, invalidJsonCode);
  }
}
