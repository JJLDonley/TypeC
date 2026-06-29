import { C_HEADER_MALFORMED_AST } from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";
import { isJsonText } from "json/values.ts";

type Str = string;

export function readHeaderJsonText(value: unknown, message: Str): Str {
  if (isJsonText(value)) return value;
  throw new TypeCError([{ message, code: C_HEADER_MALFORMED_AST }]);
}
