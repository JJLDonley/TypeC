import { MISSING_RETURN_VALUE, RETURN_TYPE, RETURN_VALUE_IN_VOID } from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkReturnStatement(
  expr: Expression | null,
  expected: TypeName,
  span: SourceSpan,
  resolveType: TypeResolver,
): Diagnostic[] {
  if (!expr) return checkBareReturn(expected, span);
  if (expected === "void") {
    return [{ message: "Void function cannot return a value", code: RETURN_VALUE_IN_VOID, span }];
  }
  const actual = resolveType(expr, expected);
  if (isAssignable(actual, expected)) return [];
  return [{
    message: `Return type '${actual}' is not assignable to '${expected}'`,
    code: RETURN_TYPE,
    span,
  }];
}

function checkBareReturn(expected: TypeName, span: SourceSpan): Diagnostic[] {
  if (expected === "void") return [];
  return [{ message: `Function must return '${expected}'`, code: MISSING_RETURN_VALUE, span }];
}
