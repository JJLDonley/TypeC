import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression, FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import {
  checkCallArgumentType,
  checkCallArity,
  checkVariadicArgumentType,
} from "checker/call_args.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";

type usize = number;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type TypeResolver = (expr: Expression) => TypeName;

export function checkCallArguments(
  args: Expression[],
  fn: FunctionDecl,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
  span: SourceSpan,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = checkCallArity(
    args.length,
    fn.params.length,
    fn.variadic === true,
    fn.name,
    span,
    minArgumentCount(fn),
  );
  for (let index: usize = 0; index < args.length && index < fn.params.length; index++) {
    diagnostics.push(
      ...checkCallArgument(args[index]!, fn.params[index]!, resolveExpectedType, index),
    );
  }
  if (fn.variadic === true) {
    diagnostics.push(...checkVariadicArguments(args, fn.params.length, resolveType));
  }
  return diagnostics;
}

function checkCallArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize],
  resolveExpectedType: ExpectedTypeResolver,
  index: usize,
): Diagnostic[] {
  const expected = typeName(param.type);
  if (param.optional === true) {
    return checkOptionalCallArgument(arg, param, resolveExpectedType, index);
  }
  const actual = resolveExpectedType(arg, expected);
  return checkCallArgumentType(actual, expected, index, arg.span);
}

function checkOptionalCallArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize],
  resolveExpectedType: ExpectedTypeResolver,
  index: usize,
): Diagnostic[] {
  const element = optionalTypeElement(param.type);
  if (element === null) {
    return checkCallArgumentType("<error>", typeName(param.type), index, arg.span);
  }
  const actual = resolveExpectedType(arg, typeName(element));
  return checkCallArgumentType(actual, typeName(element), index, arg.span);
}

function minArgumentCount(fn: FunctionDecl): usize {
  const index = fn.params.findIndex((param) => param.optional === true || param.defaultValue);
  return index < 0 ? fn.params.length : index;
}

function checkVariadicArguments(
  args: Expression[],
  start: usize,
  resolveType: TypeResolver,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (let index: usize = start; index < args.length; index++) {
    const arg = args[index]!;
    diagnostics.push(...checkVariadicArgumentType(resolveType(arg), index, arg.span));
  }
  return diagnostics;
}
