import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";
import { isVariadicArgumentType } from "checker/variadic_args.ts";

type Str = string;
type usize = number;
type b8 = boolean;

export function checkCallArity(
  argsLength: usize,
  paramsLength: usize,
  variadic: b8,
  functionName: Str,
  span: SourceSpan,
): Diagnostic[] {
  if (variadic && argsLength >= paramsLength) return [];
  if (!variadic && argsLength === paramsLength) return [];
  const expected = variadic ? `at least ${paramsLength}` : `${paramsLength}`;
  return [{
    message: `Function '${functionName}' expects ${expected} arguments, got ${argsLength}`,
    span,
  }];
}

export function checkCallArgumentType(
  actual: TypeName,
  expected: TypeName,
  index: usize,
  span: SourceSpan,
): Diagnostic[] {
  if (isAssignable(actual, expected)) return [];
  return [{
    message: `Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`,
    span,
  }];
}

export function checkVariadicArgumentType(
  actual: TypeName,
  index: usize,
  span: SourceSpan,
): Diagnostic[] {
  if (isVariadicArgumentType(actual)) return [];
  return [{
    message: `Variadic argument ${index + 1} type '${actual}' is not C variadic ABI compatible`,
    span,
  }];
}
