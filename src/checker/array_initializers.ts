import type { Diagnostic, SourceSpan } from "../diagnostics.ts";
import type { Expression } from "../ast.ts";
import type { TypeName } from "../tast.ts";
import { parseArrayType } from "checker/types.ts";

export function checkArrayInitializer(initializer: Expression, expected: TypeName, span: SourceSpan): Diagnostic[] {
  if (!parseArrayType(expected)) return [];
  if (initializer.kind === "ArrayLiteralExpr") return [];
  return [{ message: "Array variable initializer must be an array literal", span }];
}
