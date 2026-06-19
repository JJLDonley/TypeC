import type { Expression, FunctionDecl, RecordTypeRef, TypeAliasDecl } from "core/ast.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";
import { cArrayElementType, cPrecedence, emitIntegerLiteralExpression } from "emitter/helpers.ts";
import { emitCStringLiteral, emitCStringPointer, emitCStringVoidPointer } from "emitter/strings.ts";

type Str = string;
type usize = number;

export function emitExpression(expr: Expression, context: EmitContext): Str {
  switch (expr.kind) {
    case "IntegerLiteral":
      return expr.text;
    case "FloatLiteral":
      return expr.text;
    case "BoolLiteral":
      return expr.text;
    case "StringLiteral":
      return emitCStringLiteral(expr.text);
    case "IdentifierExpr":
      return expr.name;
    case "BinaryExpr":
      return emitBinaryExpression(expr, context);
    case "CallExpr":
      return emitCallExpression(expr, context);
    case "PostfixPointerExpr":
      return emitPostfixPointerExpression(expr, context);
    case "FieldAccessExpr":
      return `${emitMemberOperand(expr.operand, context)}.${expr.field}`;
    case "RecordLiteralExpr":
      throw new Error("Record literals require an expected C type");
    case "ArrayLiteralExpr":
      throw new Error("Array literals require an expected C type");
    case "IndexExpr":
      return `${emitMemberOperand(expr.operand, context)}[${emitExpression(expr.index, context)}]`;
  }
}

export function emitExpressionExpected(expr: Expression, expectedType: Str, context: EmitContext): Str {
  if (expr.kind === "IntegerLiteral") return emitIntegerLiteralExpression(expr, expectedType);
  if (expr.kind === "RecordLiteralExpr") return emitRecordLiteralExpression(expr, expectedType, context);
  if (expr.kind === "ArrayLiteralExpr") return emitArrayLiteralExpression(expr, context, expectedType);
  if (expr.kind === "StringLiteral" && expectedType === "u8*") return emitCStringPointer(expr.text);
  if (expr.kind === "StringLiteral" && expectedType === "void*") return emitCStringVoidPointer(expr.text);
  return emitExpression(expr, context);
}

function emitRecordLiteralExpression(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, expectedType: Str, context: EmitContext): Str {
  const record = context.typeAliases.get(expectedType)?.type;
  const fields = expr.fields.map((field) => emitRecordLiteralField(field, record?.kind === "RecordTypeRef" ? record : null, context)).join(", ");
  return `(${expectedType}){ ${fields} }`;
}

function emitRecordLiteralField(field: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize], record: RecordTypeRef | null, context: EmitContext): Str {
  const expected = record?.fields.find((candidate) => candidate.name === field.name);
  const value = expected ? emitExpressionExpected(field.expression, emitCTypeName(expected.type), context) : emitExpression(field.expression, context);
  return `.${field.name} = ${value}`;
}

function emitCTypeName(type: TypeAliasDecl["type"]): Str {
  if (type.kind === "FixedArrayTypeRef") return `${emitCType(type.element)}[${type.sizeText}]`;
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}*`;
  return emitCType(type);
}

function emitArrayLiteralExpression(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, context: EmitContext, expectedType: Str | null = null): Str {
  const elementType = expectedType ? cArrayElementType(expectedType) : null;
  const elements = expr.elements.map((element) => elementType ? emitExpressionExpected(element, elementType, context) : emitExpression(element, context));
  return `{ ${elements.join(", ")} }`;
}

function emitCallExpression(expr: Extract<Expression, { kind: "CallExpr" }>, context: EmitContext): Str {
  const fn = context.functions.get(expr.callee);
  const args = expr.args.map((arg, index) => emitCallArg(arg, fn?.params[index], context));
  return `${expr.callee}(${args.join(", ")})`;
}

function emitCallArg(arg: Expression, param: FunctionDecl["params"][usize] | undefined, context: EmitContext): Str {
  if (!param) return emitExpression(arg, context);
  const expectedType = emitCTypeName(param.type);
  if (arg.kind === "ArrayLiteralExpr") return emitArrayCompoundLiteral(arg, emitArrayArgumentType(param.type), context);
  if (isStringLiteralU8ArrayArgument(arg, param.type)) return emitCStringPointer(arg.text);
  return emitExpressionExpected(arg, expectedType, context);
}

function isStringLiteralU8ArrayArgument(arg: Expression, type: FunctionDecl["params"][usize]["type"]): arg is Extract<Expression, { kind: "StringLiteral" }> {
  if (arg.kind !== "StringLiteral") return false;
  if (type.kind !== "FixedArrayTypeRef" && type.kind !== "InferredArrayTypeRef") return false;
  return emitCType(type.element) === "u8";
}

function emitArrayCompoundLiteral(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, expectedType: Str, context: EmitContext): Str {
  return `(${expectedType})${emitArrayLiteralExpression(expr, context, expectedType)}`;
}

function emitArrayArgumentType(type: FunctionDecl["params"][usize]["type"]): Str {
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}[]`;
  return emitCTypeName(type);
}

function emitBinaryExpression(expr: Extract<Expression, { kind: "BinaryExpr" }>, context: EmitContext): Str {
  const left = emitBinaryOperand(expr.left, expr.operator, "left", context);
  const right = emitBinaryOperand(expr.right, expr.operator, "right", context);
  return `${left} ${expr.operator} ${right}`;
}

function emitBinaryOperand(expr: Expression, parentOperator: Str, side: "left" | "right", context: EmitContext): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind !== "BinaryExpr") return operand;
  const parent = cPrecedence(parentOperator);
  const child = cPrecedence(expr.operator);
  if (child < parent) return `(${operand})`;
  if (side === "right" && child === parent) return `(${operand})`;
  return operand;
}

function emitPostfixPointerExpression(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, context: EmitContext): Str {
  const operand = emitExpression(expr.operand, context);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

function emitMemberOperand(expr: Expression, context: EmitContext): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind === "PostfixPointerExpr" && expr.operator === ".*") return `(${operand})`;
  return operand;
}
