import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeRef } from "core/ast.ts";
import { isVoidValueType } from "checker/type_refs.ts";

type Str = string;

export function checkValueType(type: TypeRef, message: Str, span: SourceSpan): Diagnostic[] {
  if (!isVoidValueType(type)) return [];
  return [{ message, span }];
}
