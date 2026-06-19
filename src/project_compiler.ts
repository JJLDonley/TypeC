import { compilerFlagError } from "./compiler_flags.ts";
import { TypeCError } from "./diagnostics.ts";
import { type JsonRecord, isJsonRecord } from "./json_record.ts";

type Str = string;

export function readProjectCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isJsonRecord(value)) throw projectCompilerError("project.json compiler must be an object");
  rejectUnknownCompilerKeys(value);
  return readCompilerFlags(value.flags);
}

function rejectUnknownCompilerKeys(value: JsonRecord): void {
  const known = new Set<Str>(["flags"]);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw projectCompilerError(`project.json compiler has unknown key '${key}'`);
  }
}

function readCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(isFlagText)) throw projectCompilerError("project.json compiler.flags must be a string array");
  for (const flag of value) validateCompilerFlag(flag);
  return value;
}

function isFlagText(value: unknown): value is Str {
  return typeof value === "string";
}

function validateCompilerFlag(flag: Str): void {
  const message = compilerFlagError(flag);
  if (message !== null) throw projectCompilerError(message);
}

function projectCompilerError(message: Str): TypeCError {
  return new TypeCError([{ message }]);
}
