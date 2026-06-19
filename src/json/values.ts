import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function isJsonText(value: unknown): value is Str {
  return typeof value === "string";
}

export function isNonEmptyJsonText(value: unknown): value is Str {
  return isJsonText(value) && value.length > 0;
}

export function readJsonText(value: unknown, message: Str): Str {
  if (isJsonText(value)) return value;
  throw new TypeCError([{ message }]);
}

export function isJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isTruthyJsonFlag(value: unknown): b8 {
  return value === true;
}

export function isFalseJsonFlag(value: unknown): b8 {
  return value === false;
}
