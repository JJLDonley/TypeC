import { ARRAY_VARIABLE_INITIALIZER } from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isStringLiteralArrayInitializer } from "checker/string_literals.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

type b8 = boolean;

export function checkArrayInitializer(
  initializer: Expression,
  expected: TypeName,
  span: SourceSpan,
): Diagnostic[] {
  if (!parseArrayTypeName(expected)) return [];
  if (initializer.kind === "ArrayLiteralExpr") return [];
  if (initializer.kind === "ZeroValueExpr") return [];
  if (isArrayFillInitializer(initializer)) return [];
  if (isStringLiteralArrayInitializer(initializer, expected)) return [];
  return [{
    message: "Array variable initializer must be an array literal",
    code: ARRAY_VARIABLE_INITIALIZER,
    span,
  }];
}

function isArrayFillInitializer(initializer: Expression): b8 {
  return initializer.kind === "MethodCallExpr" && initializer.receiver.kind === "IdentifierExpr" &&
    initializer.receiver.name === "Array" && initializer.method === "fill";
}
