import type { Expression, FunctionDecl } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";
import { isAssignable } from "checker/types.ts";

type usize = number;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkParameterDefaults(
  fn: FunctionDecl,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  return fn.params.flatMap((param, index) => [
    ...checkRequiredOrder(fn, index),
    ...checkParameterDefault(param, resolveExpectedType),
  ]);
}

function checkRequiredOrder(fn: FunctionDecl, index: usize): Diagnostic[] {
  const param = fn.params[index]!;
  if (param.optional === true || param.defaultValue) return [];
  const previousFlexible = fn.params.slice(0, index).some((candidate) =>
    candidate.optional === true || candidate.defaultValue
  );
  if (!previousFlexible) return [];
  return [{
    message: `Required parameter '${param.name}' cannot follow optional/default parameter`,
    span: param.span,
  }];
}

function checkParameterDefault(
  param: FunctionDecl["params"][usize],
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  if (!param.defaultValue) return [];
  const expected = defaultExpectedType(param);
  const actual = resolveExpectedType(param.defaultValue, expected);
  if (isAssignable(actual, expected)) return [];
  return [{
    message:
      `Default value type '${actual}' is not assignable to parameter '${param.name}' type '${expected}'`,
    span: param.defaultValue.span,
  }];
}

function defaultExpectedType(param: FunctionDecl["params"][usize]): TypeName {
  if (param.optional !== true) return typeName(param.type);
  const element = optionalTypeElement(param.type);
  return element === null ? "<error>" : typeName(element);
}
