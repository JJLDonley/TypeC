import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isStringLiteralArrayInitializer } from "checker/string_literals.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

export function checkArrayInitializer(
  initializer: Expression,
  expected: TypeName,
  span: SourceSpan,
): Diagnostic[] {
  if (!parseArrayTypeName(expected)) return [];
  if (initializer.kind === "ArrayLiteralExpr") return [];
  if (isStringLiteralArrayInitializer(initializer, expected)) return [];
  return [{ message: "Array variable initializer must be an array literal", span }];
}
