import { CALL_ARGUMENT_TYPE, CALL_ARITY, VARIADIC_ARGUMENT_TYPE } from "core/diagnostic_codes.ts";
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
  minArgsLength: usize = paramsLength,
): Diagnostic[] {
  if (variadic && argsLength >= minArgsLength) return [];
  if (!variadic && argsLength >= minArgsLength && argsLength <= paramsLength) return [];
  const expected = arityExpected(paramsLength, minArgsLength, variadic);
  return [{
    message: `Function '${functionName}' expects ${expected} arguments, got ${argsLength}`,
    code: CALL_ARITY,
    span,
  }];
}

function arityExpected(paramsLength: usize, minArgsLength: usize, variadic: b8): Str {
  if (variadic) return `at least ${minArgsLength}`;
  if (minArgsLength === paramsLength) return `${paramsLength}`;
  return `${minArgsLength} to ${paramsLength}`;
}

export function checkCallArgumentType(
  actual: TypeName,
  expected: TypeName,
  index: usize,
  span: SourceSpan,
): Diagnostic[] {
  if (actual === "<error>") return [];
  if (isAssignable(actual, expected)) return [];
  return [{
    message: `Argument ${index + 1} type '${actual}' is not assignable to '${expected}'`,
    code: CALL_ARGUMENT_TYPE,
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
    code: VARIADIC_ARGUMENT_TYPE,
    span,
  }];
}
