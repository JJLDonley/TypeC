import {
  JSON_UNKNOWN_KEY,
  PROJECT_COMPILER_FLAG,
  PROJECT_COMPILER_FLAGS,
  PROJECT_COMPILER_OBJECT,
} from "core/diagnostic_codes.ts";
import { compilerFlagError } from "project/flags.ts";
import { jsonConfigError, rejectUnknownJsonKeys } from "json/config.ts";
import { isJsonRecord } from "json/record.ts";
import { isJsonArray, isJsonText } from "json/values.ts";

type Str = string;

export function readProjectCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isJsonRecord(value)) {
    throw jsonConfigError("project.json compiler must be an object", PROJECT_COMPILER_OBJECT);
  }
  rejectUnknownJsonKeys("project.json compiler", value, ["flags"], JSON_UNKNOWN_KEY);
  return readCompilerFlags(value.flags);
}

function readCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isJsonArray(value) || !value.every(isJsonText)) {
    throw jsonConfigError(
      "project.json compiler.flags must be a string array",
      PROJECT_COMPILER_FLAGS,
    );
  }
  for (const flag of value) validateCompilerFlag(flag);
  return value;
}

function validateCompilerFlag(flag: Str): void {
  const message = compilerFlagError(flag);
  if (message !== null) throw jsonConfigError(message, PROJECT_COMPILER_FLAG);
}
