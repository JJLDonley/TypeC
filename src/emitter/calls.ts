import type { Expression, FunctionDecl } from "core/ast.ts";
import { optionalCTypeNameFromTypeName } from "c/optional_names.ts";
import { emitCType } from "c/type.ts";
import { emitArenaCallExpression } from "emitter/arenas.ts";
import { spanKey } from "checker/exprs.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCStringPointer } from "emitter/strings.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type usize = number;

type ExpressionEmitter = (expr: Expression, context: EmitContext) => Str;
type ExpectedExpressionEmitter = (expr: Expression, expectedType: Str, context: EmitContext) => Str;
type ArrayLiteralEmitter = (
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  context: EmitContext,
  expectedType: Str | null,
) => Str;

export function emitCallExpression(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
  emitArrayLiteralExpression: ArrayLiteralEmitter,
): Str {
  const arenaCall = emitArenaCallExpression(expr, context, emitExpression);
  if (arenaCall !== null) return arenaCall;
  const optionalCall = emitOptionalConstructorCall(expr, context, emitExpressionExpected);
  if (optionalCall !== null) return optionalCall;
  const fn = context.functions.get(expr.callee);
  const args = expr.args.map((arg, index) =>
    emitCallArg(
      arg,
      fn?.params[index],
      context,
      emitExpression,
      emitExpressionExpected,
      emitArrayLiteralExpression,
    )
  );
  return `${fn?.cName ?? expr.callee}(${args.join(", ")})`;
}

function emitOptionalConstructorCall(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  context: EmitContext,
  emitExpressionExpected: ExpectedExpressionEmitter,
): Str | null {
  if (expr.callee !== "Some" && expr.callee !== "None") return null;
  const typeArg = expr.typeArgs?.[0];
  if (!typeArg) return `${expr.callee}()`;
  const elementType = typeName(typeArg);
  const optionalType = optionalCTypeNameFromTypeName(elementType);
  if (expr.callee === "None") return `(${optionalType}){ .present = false }`;
  const valueType = emitCTypeName(typeArg, context.typeAliases);
  const value = expr.args[0] ? emitExpressionExpected(expr.args[0], valueType, context) : "0";
  return `(${optionalType}){ .present = true, .value = ${value} }`;
}

function emitCallArg(
  arg: Expression,
  param: FunctionDecl["params"][usize] | undefined,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
  emitExpressionExpected: ExpectedExpressionEmitter,
  emitArrayLiteralExpression: ArrayLiteralEmitter,
): Str {
  if (!param) return emitExpression(arg, context);
  if (param.type.kind === "FunctionTypeRef") return emitExpression(arg, context);
  const expectedType = emitCTypeName(param.type, context.typeAliases);
  if (arg.kind === "ArrayLiteralExpr") {
    return emitArrayCompoundLiteral(
      arg,
      emitArrayArgumentType(param.type, context),
      context,
      emitArrayLiteralExpression,
    );
  }
  if (isStringLiteralU8ArrayArgument(arg, param.type)) return emitCStringPointer(arg.text);
  if (param.type.kind === "SliceTypeRef") {
    return emitSliceCallArg(arg, expectedType, context, emitExpression);
  }
  return emitExpressionExpected(arg, expectedType, context);
}

function emitSliceCallArg(
  arg: Expression,
  expectedType: Str,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
): Str {
  const actualType = context.expressionTypes?.get(spanKey(arg.span))?.type ?? null;
  const array = actualType ? parseArrayTypeName(actualType) : null;
  if (array?.length === null || array === null) return emitExpression(arg, context);
  return `(${expectedType}){ .data = ${emitExpression(arg, context)}, .length = ${array.length} }`;
}

function isStringLiteralU8ArrayArgument(
  arg: Expression,
  type: FunctionDecl["params"][usize]["type"],
): arg is Extract<Expression, { kind: "StringLiteral" }> {
  if (arg.kind !== "StringLiteral") return false;
  if (type.kind !== "FixedArrayTypeRef" && type.kind !== "InferredArrayTypeRef") return false;
  return emitCType(type.element, new Map()) === "u8";
}

function emitArrayCompoundLiteral(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  expectedType: Str,
  context: EmitContext,
  emitArrayLiteralExpression: ArrayLiteralEmitter,
): Str {
  return `(${expectedType})${emitArrayLiteralExpression(expr, context, expectedType)}`;
}

function emitArrayArgumentType(
  type: FunctionDecl["params"][usize]["type"],
  context: EmitContext,
): Str {
  if (type.kind === "InferredArrayTypeRef") {
    return `${emitCType(type.element, context.typeAliases)}[]`;
  }
  return emitCTypeName(type, context.typeAliases);
}
