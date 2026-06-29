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
  const restIndex = restParamIndex(params);
  if (restIndex !== null) {
    return emitRestCallArguments(
      args,
      params,
      restIndex,
      context,
      emitArgument,
      emitExpressionExpected,
    );
  }
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

function emitRestCallArguments(
  args: Expression[],
  params: FunctionDecl["params"],
  restIndex: usize,
  context: EmitContext,
  emitArgument: ArgumentEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str[] {
  const emitted: Str[] = [];
  for (let index: usize = 0; index < restIndex; index++) {
    emitted.push(
      emitCallArgumentAt(index, args, params, context, emitArgument, emitExpressionExpected),
    );
  }
  emitted.push(
    emitRestArgument(args.slice(restIndex), params[restIndex]!, context, emitExpressionExpected),
  );
  return emitted;
}

function restParamIndex(params: FunctionDecl["params"]): usize | null {
  const index = params.findIndex((param) => param.rest === true);
  return index < 0 ? null : index;
}

function emitRestArgument(
  args: Expression[],
  param: FunctionDecl["params"][usize],
  context: EmitContext,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str {
  const sliceType = emitCTypeName(param.type, context.typeAliases);
  const elementType = restElementCType(param, context);
  if (args.length === 0) return `(${sliceType}){ .data = NULL, .length = 0 }`;
  const values = args.map((arg) => emitExpressionExpected(arg, elementType, context)).join(", ");
  return `(${sliceType}){ .data = (${elementType}[]){ ${values} }, .length = ${args.length} }`;
}

function restElementCType(param: FunctionDecl["params"][usize], context: EmitContext): Str {
  if (param.type.kind === "SliceTypeRef" || param.type.kind === "InferredArrayTypeRef") {
    return emitCTypeName(param.type.element, context.typeAliases);
  }
  return emitCTypeName(param.type, context.typeAliases);
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
