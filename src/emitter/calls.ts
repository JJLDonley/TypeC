import type { Expression, FunctionDecl } from "core/ast.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCStringPointer } from "emitter/strings.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;
type usize = number;

type ExpressionEmitter = (expr: Expression, context: EmitContext) => Str;
type ExpectedExpressionEmitter = (expr: Expression, expectedType: Str, context: EmitContext) => Str;
type ArrayLiteralEmitter = (expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, context: EmitContext, expectedType: Str | null) => Str;

export function emitCallExpression(expr: Extract<Expression, { kind: "CallExpr" }>, context: EmitContext, emitExpression: ExpressionEmitter, emitExpressionExpected: ExpectedExpressionEmitter, emitArrayLiteralExpression: ArrayLiteralEmitter): Str {
  const fn = context.functions.get(expr.callee);
  const args = expr.args.map((arg, index) => emitCallArg(arg, fn?.params[index], context, emitExpression, emitExpressionExpected, emitArrayLiteralExpression));
  return `${expr.callee}(${args.join(", ")})`;
}

function emitCallArg(arg: Expression, param: FunctionDecl["params"][usize] | undefined, context: EmitContext, emitExpression: ExpressionEmitter, emitExpressionExpected: ExpectedExpressionEmitter, emitArrayLiteralExpression: ArrayLiteralEmitter): Str {
  if (!param) return emitExpression(arg, context);
  const expectedType = emitCTypeName(param.type);
  if (arg.kind === "ArrayLiteralExpr") return emitArrayCompoundLiteral(arg, emitArrayArgumentType(param.type), context, emitArrayLiteralExpression);
  if (isStringLiteralU8ArrayArgument(arg, param.type)) return emitCStringPointer(arg.text);
  return emitExpressionExpected(arg, expectedType, context);
}

function isStringLiteralU8ArrayArgument(arg: Expression, type: FunctionDecl["params"][usize]["type"]): arg is Extract<Expression, { kind: "StringLiteral" }> {
  if (arg.kind !== "StringLiteral") return false;
  if (type.kind !== "FixedArrayTypeRef" && type.kind !== "InferredArrayTypeRef") return false;
  return emitCType(type.element) === "u8";
}

function emitArrayCompoundLiteral(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, expectedType: Str, context: EmitContext, emitArrayLiteralExpression: ArrayLiteralEmitter): Str {
  return `(${expectedType})${emitArrayLiteralExpression(expr, context, expectedType)}`;
}

function emitArrayArgumentType(type: FunctionDecl["params"][usize]["type"]): Str {
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}[]`;
  return emitCTypeName(type);
}
