import type { Expression, FunctionDecl } from "core/ast.ts";
import { optionalCTypeNameFromTypeName } from "c/optional_names.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type usize = number;

type ArgumentEmitter = (
  arg: Expression,
  param: FunctionDecl["params"][usize] | undefined,
) => Str;
type ExpectedExpressionEmitter = (expr: Expression, expectedType: Str, context: EmitContext) => Str;

export function emitCallArguments(
  args: Expression[],
  params: FunctionDecl["params"],
  context: EmitContext,
  emitArgument: ArgumentEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str[] {
  const emitted: Str[] = [];
  for (let index: usize = 0; index < params.length; index++) {
    emitted.push(
      emitCallArgumentAt(index, args, params, context, emitArgument, emitExpressionExpected),
    );
  }
  return emitted;
}

function emitCallArgumentAt(
  index: usize,
  args: Expression[],
  params: FunctionDecl["params"],
  context: EmitContext,
  emitArgument: ArgumentEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str {
  const param = params[index]!;
  const arg = args[index] ?? null;
  if (arg !== null) {
    return emitProvidedArgument(arg, param, context, emitArgument, emitExpressionExpected);
  }
  return emitMissingArgument(param, context, emitExpressionExpected);
}

function emitProvidedArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize],
  context: EmitContext,
  emitArgument: ArgumentEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str {
  if (param.optional !== true) return emitArgument(arg, param);
  return emitOptionalSomeArgument(arg, param, context, emitExpressionExpected);
}

function emitMissingArgument(
  param: FunctionDecl["params"][usize],
  context: EmitContext,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str {
  if (param.defaultValue) {
    if (param.optional === true) {
      return emitOptionalSomeArgument(param.defaultValue, param, context, emitExpressionExpected);
    }
    return emitExpressionExpected(
      param.defaultValue,
      emitCTypeName(param.type, context.typeAliases),
      context,
    );
  }
  if (param.optional === true) return emitOptionalNoneArgument(param);
  return "0";
}

function emitOptionalSomeArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize],
  context: EmitContext,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str {
  const element = optionalTypeElement(param.type);
  if (element === null) return "0";
  const elementName = typeName(element);
  const optionalType = optionalCTypeNameFromTypeName(elementName);
  const expectedType = emitCTypeName(element, context.typeAliases);
  return `(${optionalType}){ .present = true, .value = ${
    emitExpressionExpected(arg, expectedType, context)
  } }`;
}

function emitOptionalNoneArgument(param: FunctionDecl["params"][usize]): Str {
  const element = optionalTypeElement(param.type);
  if (element === null) return "0";
  return `(${optionalCTypeNameFromTypeName(typeName(element))}){ .present = false }`;
}
