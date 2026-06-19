import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;
type usize = number;

export function checkCallArity(argsLength: usize, paramsLength: usize, functionName: Str, span: SourceSpan): Diagnostic[] {
  if (argsLength === paramsLength) return [];
  return [{ message: `Function '${functionName}' expects ${paramsLength} arguments, got ${argsLength}`, span }];
}

export function checkCallArgumentType(actual: TypeName, expected: TypeName, index: usize, span: SourceSpan): Diagnostic[] {
  if (isAssignable(actual, expected)) return [];
  return [{ message: `Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`, span }];
}
