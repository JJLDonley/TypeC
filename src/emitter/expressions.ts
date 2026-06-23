import type { Expression, RecordTypeRef } from "core/ast.ts";
import {
  optionalCTypeNameFromTypeName,
  optionalUnwrapFunctionNameFromTypeName,
} from "c/optional_names.ts";
import { classMethodName } from "core/classes.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCallExpression } from "emitter/calls.ts";
import { expectedRecordType } from "emitter/record_types.ts";
import { cArrayElementType, cPrecedence, emitIntegerLiteralExpression } from "emitter/helpers.ts";
import { emitCStringLiteral, emitCStringPointer, emitCStringVoidPointer } from "emitter/strings.ts";
import { emitTaggedUnionConstructor, emitTaggedUnionFieldAccess } from "emitter/tagged_unions.ts";
import { spanKey } from "checker/exprs.ts";
import {
  optionalTypeNameElement,
  parseArrayTypeName,
  parseSliceTypeName,
} from "checker/type_name_shapes.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;
type b8 = boolean;
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
      return emitIdentifierExpression(expr.name, context);
    case "UnaryExpr":
      return emitUnaryExpression(expr, context);
    case "BinaryExpr":
      return emitBinaryExpression(expr, context);
    case "ConditionalExpr":
      return emitConditionalExpression(expr, context);
    case "NullishCoalesceExpr":
      return emitNullishCoalesceExpression(expr, context);
    case "CallExpr":
      return emitCallExpression(
        expr,
        context,
        emitExpression,
        emitExpressionExpected,
        emitArrayLiteralExpression,
      );
    case "MethodCallExpr":
      return emitMethodCallExpression(expr, context);
    case "PostfixPointerExpr":
      return emitPostfixPointerExpression(expr, context);
    case "NonNullAssertExpr":
      return emitNonNullAssertExpression(expr, context);
    case "FieldAccessExpr":
      return emitFieldAccessExpression(expr, context);
    case "OptionalFieldAccessExpr":
      return emitOptionalFieldAccessExpression(expr, context);
    case "OptionalMethodCallExpr":
      return emitOptionalMethodCallExpression(expr, context);
    case "OptionalIndexExpr":
      return emitOptionalIndexExpression(expr, context);
    case "RecordLiteralExpr":
      throw new Error("Record literals require an expected C type");
    case "ArrayLiteralExpr":
      throw new Error("Array literals require an expected C type");
    case "IndexExpr":
      return emitIndexExpression(expr, context);
  }
}

export function emitExpressionExpected(
  expr: Expression,
  expectedType: Str,
  context: EmitContext,
): Str {
  if (expr.kind === "IntegerLiteral") return emitIntegerLiteralExpression(expr, expectedType);
  if (expr.kind === "RecordLiteralExpr") {
    return emitRecordLiteralExpression(expr, expectedType, context);
  }
  if (expr.kind === "ArrayLiteralExpr") {
    return emitArrayLiteralExpression(expr, context, expectedType);
  }
  if (expr.kind === "StringLiteral" && expectedType === "u8*") return emitCStringPointer(expr.text);
  if (expr.kind === "StringLiteral" && expectedType === "void*") {
    return emitCStringVoidPointer(expr.text);
  }
  const slice = parseSliceTypeName(expectedType);
  if (slice || expectedType.startsWith("Slice_")) {
    return emitSliceExpression(expr, expectedType, context);
  }
  return emitExpression(expr, context);
}

function emitMethodCallExpression(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  context: EmitContext,
): Str {
  const unionConstructor = emitTaggedUnionConstructor(expr, context, emitExpressionExpected);
  if (unionConstructor !== null) return unionConstructor;
  const namespaceCall = emitNamespaceCallExpression(expr, context);
  if (namespaceCall !== null) return namespaceCall;
  const receiverType = context.expressionTypes?.get(spanKey(expr.receiver.span))?.type ?? "<error>";
  const methodName = classMethodName(receiverType, expr.method);
  const functionName = context.functions.get(methodName)?.cName ?? methodName;
  const args = [expr.receiver, ...expr.args].map((arg) => emitExpression(arg, context));
  return `${functionName}(${args.join(", ")})`;
}

function emitNamespaceCallExpression(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  context: EmitContext,
): Str | null {
  if (expr.receiver.kind !== "IdentifierExpr") return null;
  const callee = `${expr.receiver.name}.${expr.method}`;
  const fn = context.functions.get(callee) ?? null;
  if (fn === null) return null;
  const args = expr.args.map((arg) => emitExpression(arg, context));
  return `${fn.cName ?? fn.name}(${args.join(", ")})`;
}

function emitUnaryExpression(
  expr: Extract<Expression, { kind: "UnaryExpr" }>,
  context: EmitContext,
): Str {
  return `${expr.operator}${emitUnaryOperand(expr.operand, context)}`;
}

function emitUnaryOperand(expr: Expression, context: EmitContext): Str {
  if (expr.kind === "BinaryExpr") return `(${emitExpression(expr, context)})`;
  return emitExpression(expr, context);
}

function emitIdentifierExpression(name: Str, context: EmitContext): Str {
  return context.constants?.get(name)?.cName ?? name;
}

function emitNonNullAssertExpression(
  expr: Extract<Expression, { kind: "NonNullAssertExpr" }>,
  context: EmitContext,
): Str {
  const operandType = context.expressionTypes?.get(spanKey(expr.operand.span))?.type ?? "<error>";
  const elementType = operandType.endsWith("?") ? operandType.slice(0, -1) : "<error>";
  const unwrapName = optionalUnwrapFunctionNameFromTypeName(elementType);
  return `${unwrapName}(${emitExpression(expr.operand, context)})`;
}

function emitSliceExpression(expr: Expression, expectedType: Str, context: EmitContext): Str {
  const actual = context.expressionTypes?.get(spanKey(expr.span))?.type ?? null;
  const array = actual ? parseArrayTypeName(actual) : null;
  if (array?.length === null || array === null) return emitExpression(expr, context);
  return `(${expectedType}){ .data = ${emitExpression(expr, context)}, .length = ${array.length} }`;
}

function emitRecordLiteralExpression(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const record = expectedRecordType(expectedType, context);
  const fields = expr.fields.map((field) => emitRecordLiteralField(field, record, context)).join(
    ", ",
  );
  return `(${expectedType}){ ${fields} }`;
}

function emitRecordLiteralField(
  field: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize],
  record: RecordTypeRef | null,
  context: EmitContext,
): Str {
  const expected = record?.fields.find((candidate) => candidate.name === field.name);
  const value = expected
    ? emitExpressionExpected(
      field.expression,
      emitCTypeName(expected.type, context.typeAliases),
      context,
    )
    : emitExpression(field.expression, context);
  return `.${field.name} = ${value}`;
}

function emitArrayLiteralExpression(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  context: EmitContext,
  expectedType: Str | null = null,
): Str {
  const elementType = expectedType ? cArrayElementType(expectedType) : null;
  const elements = expr.elements.map((element) =>
    elementType
      ? emitExpressionExpected(element, elementType, context)
      : emitExpression(element, context)
  );
  return `{ ${elements.join(", ")} }`;
}

function emitIndexExpression(
  expr: Extract<Expression, { kind: "IndexExpr" }>,
  context: EmitContext,
): Str {
  const operand = emitMemberOperand(expr.operand, context);
  const index = emitExpression(expr.index, context);
  if (isSliceExpression(expr.operand, context)) return `${operand}.data[${index}]`;
  return `${operand}[${index}]`;
}

function isSliceExpression(expr: Expression, context: EmitContext): b8 {
  const type = context.expressionTypes?.get(spanKey(expr.span))?.type ?? null;
  return type !== null && parseSliceTypeName(type) !== null;
}

function emitBinaryExpression(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  context: EmitContext,
): Str {
  const left = emitBinaryOperand(expr.left, expr.operator, "left", context);
  const right = emitBinaryOperand(expr.right, expr.operator, "right", context);
  return `${left} ${emitBinaryOperator(expr.operator)} ${right}`;
}

function emitBinaryOperator(operator: Str): Str {
  return operator === ">>>" ? ">>" : operator;
}

function emitConditionalExpression(
  expr: Extract<Expression, { kind: "ConditionalExpr" }>,
  context: EmitContext,
): Str {
  const condition = emitConditionalOperand(expr.condition, context);
  const whenTrue = emitConditionalBranch(expr.whenTrue, context);
  const whenFalse = emitConditionalBranch(expr.whenFalse, context);
  return `${condition} ? ${whenTrue} : ${whenFalse}`;
}

function emitConditionalOperand(expr: Expression, context: EmitContext): Str {
  if (expr.kind === "ConditionalExpr") return `(${emitExpression(expr, context)})`;
  return emitExpression(expr, context);
}

function emitConditionalBranch(expr: Expression, context: EmitContext): Str {
  if (expr.kind === "ConditionalExpr") return `(${emitExpression(expr, context)})`;
  return emitExpression(expr, context);
}

function emitNullishCoalesceExpression(
  expr: Extract<Expression, { kind: "NullishCoalesceExpr" }>,
  context: EmitContext,
): Str {
  const left = emitExpression(expr.left, context);
  const fallbackType = context.expressionTypes?.get(spanKey(expr.fallback.span))?.type ?? "";
  const fallback = emitExpressionExpected(expr.fallback, fallbackType, context);
  return `${left}.present ? ${left}.value : ${fallback}`;
}

function emitBinaryOperand(
  expr: Expression,
  parentOperator: Str,
  side: "left" | "right",
  context: EmitContext,
): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind === "ConditionalExpr" || expr.kind === "NullishCoalesceExpr") return `(${operand})`;
  if (expr.kind !== "BinaryExpr") return operand;
  const parent = cPrecedence(parentOperator);
  const child = cPrecedence(expr.operator);
  if (child < parent) return `(${operand})`;
  if (side === "right" && child === parent) return `(${operand})`;
  return operand;
}

function emitOptionalFieldAccessExpression(
  expr: Extract<Expression, { kind: "OptionalFieldAccessExpr" }>,
  context: EmitContext,
): Str {
  const operand = emitMemberOperand(expr.operand, context);
  return emitOptionalChainResult(expr, `${operand}.value.${expr.field}`, context);
}

function emitOptionalMethodCallExpression(
  expr: Extract<Expression, { kind: "OptionalMethodCallExpr" }>,
  context: EmitContext,
): Str {
  const receiverType = context.expressionTypes?.get(spanKey(expr.receiver.span))?.type ?? "<error>";
  const elementType = optionalTypeNameElement(receiverType) ?? "<error>";
  const methodName = classMethodName(elementType, expr.method);
  const functionName = context.functions.get(methodName)?.cName ?? methodName;
  const receiver = `${emitExpression(expr.receiver, context)}.value`;
  const args = expr.args.map((arg) => emitExpression(arg, context));
  return emitOptionalChainResult(
    expr,
    `${functionName}(${[receiver, ...args].join(", ")})`,
    context,
  );
}

function emitOptionalIndexExpression(
  expr: Extract<Expression, { kind: "OptionalIndexExpr" }>,
  context: EmitContext,
): Str {
  const operand = emitMemberOperand(expr.operand, context);
  const index = emitExpression(expr.index, context);
  return emitOptionalChainResult(expr, `${operand}.value[${index}]`, context);
}

function emitOptionalChainResult(expr: Expression, presentValue: Str, context: EmitContext): Str {
  const optionalType = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "<error>";
  const elementType = optionalTypeNameElement(optionalType) ?? "<error>";
  const cType = optionalCTypeNameFromTypeName(elementType);
  const operand = optionalChainOperand(expr);
  const emittedOperand = operand === null ? "" : emitExpression(operand, context);
  return `${emittedOperand}.present ? (${cType}){ .present = true, .value = ${presentValue} } : (${cType}){ .present = false }`;
}

function optionalChainOperand(expr: Expression): Expression | null {
  if (expr.kind === "OptionalFieldAccessExpr" || expr.kind === "OptionalIndexExpr") {
    return expr.operand;
  }
  if (expr.kind === "OptionalMethodCallExpr") return expr.receiver;
  return null;
}

function emitFieldAccessExpression(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): Str {
  const constant = emitQualifiedConstantExpression(expr, context);
  if (constant !== null) return constant;
  if (isArrayDataFieldAccess(expr, context)) return emitMemberOperand(expr.operand, context);
  if (isSliceDataFieldAccess(expr, context)) {
    return `${emitMemberOperand(expr.operand, context)}.data`;
  }
  if (isArrayLengthFieldAccess(expr, context)) return emitArrayLengthExpression(expr, context);
  if (isSliceLengthFieldAccess(expr, context)) {
    return `${emitMemberOperand(expr.operand, context)}.length`;
  }
  const receiverType = context.expressionTypes?.get(spanKey(expr.operand.span))?.type ?? "<error>";
  const unionAccess = emitTaggedUnionFieldAccess(expr, receiverType, context, emitMemberOperand);
  if (unionAccess !== null) return unionAccess;
  return `${emitMemberOperand(expr.operand, context)}.${expr.field}`;
}

function emitQualifiedConstantExpression(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): Str | null {
  const name = qualifiedExpressionName(expr);
  return name === null ? null : context.constants?.get(name)?.cName ?? null;
}

function isArrayDataFieldAccess(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): b8 {
  if (expr.field !== "data") return false;
  return arrayOperandType(expr, context) !== null;
}

function isSliceDataFieldAccess(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): b8 {
  if (expr.field !== "data") return false;
  return sliceOperandType(expr, context) !== null;
}

function isArrayLengthFieldAccess(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): b8 {
  if (expr.field !== "length()") return false;
  return arrayOperandType(expr, context) !== null;
}

function isSliceLengthFieldAccess(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): b8 {
  if (expr.field !== "length()") return false;
  return sliceOperandType(expr, context) !== null;
}

function emitArrayLengthExpression(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): Str {
  const array = arrayOperandType(expr, context);
  if (array?.length === null || array === null) {
    throw new Error("Array length emission requires fixed array type");
  }
  return `${array.length}`;
}

function arrayOperandType(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): ReturnType<typeof parseArrayTypeName> {
  const operandType = operandTypeName(expr, context);
  return operandType === null ? null : parseArrayTypeName(operandType);
}

function sliceOperandType(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): ReturnType<typeof parseSliceTypeName> {
  const operandType = operandTypeName(expr, context);
  return operandType === null ? null : parseSliceTypeName(operandType);
}

function operandTypeName(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): Str | null {
  return context.expressionTypes?.get(spanKey(expr.operand.span))?.type ?? null;
}

function emitPostfixPointerExpression(
  expr: Extract<Expression, { kind: "PostfixPointerExpr" }>,
  context: EmitContext,
): Str {
  const operand = emitExpression(expr.operand, context);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

function emitMemberOperand(expr: Expression, context: EmitContext): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind === "PostfixPointerExpr" && expr.operator === ".*") return `(${operand})`;
  return operand;
}
