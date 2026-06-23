import { TypeCError } from "core/diagnostics.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";

type Str = string;

export function parseJsonRecord(
  text: Str,
  invalidJsonMessage: Str,
  nonRecordMessage: Str,
): JsonRecord {
  const value = parseJson(text, invalidJsonMessage);
  if (!isJsonRecord(value)) throw jsonConfigError(nonRecordMessage);
  return value;
}

export function rejectUnknownJsonKeys(scope: Str, value: JsonRecord, knownKeys: Str[]): void {
  const known = new Set<Str>(knownKeys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw jsonConfigError(`${scope} has unknown key '${key}'`);
  }
}

export function jsonConfigError(message: Str): TypeCError {
  return new TypeCError([{ message }]);
}

function parseJson(text: Str, invalidJsonMessage: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw jsonConfigError(invalidJsonMessage);
  }
}
