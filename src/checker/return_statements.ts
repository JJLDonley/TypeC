import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkReturnStatement(expr: Expression | null, expected: TypeName, span: SourceSpan, resolveType: TypeResolver): Diagnostic[] {
  if (!expr) return checkBareReturn(expected, span);
  if (expected === "void") return [{ message: "Void function cannot return a value", span }];
  const actual = resolveType(expr, expected);
  if (isAssignable(actual, expected)) return [];
  return [{ message: `Return type '${actual}' is not assignable to '${expected}'`, span }];
}

function checkBareReturn(expected: TypeName, span: SourceSpan): Diagnostic[] {
  if (expected === "void") return [];
  return [{ message: `Function must return '${expected}'`, span }];
}
