import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import type { TypeRef } from "./ast.ts";
import { isVoidValueType } from "./checker_type_refs.ts";

type Str = string;

export function checkValueType(type: TypeRef, message: Str, span: SourceSpan): Diagnostic[] {
  if (!isVoidValueType(type)) return [];
  return [{ message, span }];
}
