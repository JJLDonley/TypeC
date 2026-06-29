import type { Expression, FunctionDecl, RecordTypeRef } from "core/ast.ts";
import {
  optionalCTypeNameFromTypeName,
  optionalUnwrapFunctionNameFromTypeName,
} from "c/optional_names.ts";
import { arrowFunctionName } from "core/arrow_functions.ts";
import { classConstructorName, classMethodName } from "core/classes.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import { typeName } from "core/type_ref.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCallArguments } from "emitter/call_arguments.ts";
import { emitCallExpression } from "emitter/calls.ts";
import { borrowedInterfaceLiteral, borrowedSourceName } from "emitter/borrowed_interfaces.ts";
import { expectedRecordType } from "emitter/record_types.ts";
import { cArrayElementType, cPrecedence, emitIntegerLiteralExpression } from "emitter/helpers.ts";
import { emitCStringLiteral, emitCStringPointer, emitCStringVoidPointer } from "emitter/strings.ts";
import { emitTaggedUnionConstructor, emitTaggedUnionFieldAccess } from "emitter/tagged_unions.ts";
import { spanKey } from "checker/exprs.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import {
  optionalTypeNameElement,
  parseArrayTypeName,
  parseSliceTypeName,
  parseTupleTypeName,
} from "checker/type_name_shapes.ts";
import { tupleCTypeNameFromTypeNames } from "c/tuples.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;
type b8 = boolean;
type usize = number;
type IntLiteralValue = bigint;

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
    case "ArrowFunctionExpr":
      return arrowFunctionName(expr.span);
    case "ZeroValueExpr":
      throw new Error("Zero values require an expected C type");
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
    case "CastExpr":
      return emitCastExpression(expr, context);
    case "SatisfiesExpr":
      return emitExpression(expr.expression, context);
    case "CallExpr":
      return emitCallExpression(
        expr,
        context,
        emitExpression,
        emitExpressionExpected,
        emitArrayLiteralExpression,
      );
    case "NewExpr":
      return emitNewExpression(expr, context);
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
  const borrowed = emitBorrowedInterfaceExpected(expr, expectedType, context);
  if (borrowed !== null) return borrowed;
  if (expr.kind === "ZeroValueExpr") return `(${expectedType}){0}`;
  if (expr.kind === "IntegerLiteral") return emitIntegerLiteralExpression(expr, expectedType);
  if (expr.kind === "CallExpr") {
    const optional = emitExpectedOptionalConstructorExpression(expr, context);
    if (optional !== null) return optional;
  }
  if (expr.kind === "RecordLiteralExpr") {
    return emitRecordLiteralExpression(expr, expectedType, context);
  }
  if (isArrayFillExpression(expr)) {
    return emitArrayFillExpression(expr, expectedType, context);
  }
  if (expr.kind === "SatisfiesExpr") {
    return emitExpressionExpected(expr.expression, expectedType, context);
  }
  if (expr.kind === "ArrayLiteralExpr") {
    const tuple = parseTupleTypeName(expectedType);
    if (tuple !== null) return emitTupleLiteralExpression(expr, tuple.elements, context);
    const sliceLiteral = emitSliceArrayLiteralExpression(expr, expectedType, context);
    if (sliceLiteral !== null) return sliceLiteral;
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

function emitBorrowedInterfaceExpected(
  expr: Expression,
  expectedType: Str,
  context: EmitContext,
): Str | null {
  if (expr.kind !== "PostfixPointerExpr" || expr.operator !== ".&") return null;
  const interfaceDecl =
    context.program?.interfaces?.find((candidate) => candidate.name === expectedType) ?? null;
  if (interfaceDecl === null) return null;
  const sourceType = context.expressionTypes?.get(spanKey(expr.span))?.type ?? null;
  if (sourceType === null || borrowedSourceName(sourceType) === null) return null;
  return borrowedInterfaceLiteral(
    expectedType,
    sourceType,
    emitPostfixPointerExpression(expr, context),
    interfaceDecl,
  );
}

function isArrayFillExpression(
  expr: Expression,
): expr is Extract<Expression, { kind: "MethodCallExpr" }> {
  return expr.kind === "MethodCallExpr" && expr.receiver.kind === "IdentifierExpr" &&
    expr.receiver.name === "Array" && expr.method === "fill";
}

function emitArrayFillExpression(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const elementType = cArrayElementType(expectedType) ?? "<error>";
  const array = parseArrayTypeName(expectedType);
  const length = array?.length ?? 0n;
  const elements: Str[] = [];
  let index: IntLiteralValue = 0n;
  while (index < length) {
    elements.push(emitArrayFillElement(expr.args[0]!, elementType, index, context));
    index += 1n;
  }
  return `{ ${elements.join(", ")} }`;
}

function emitArrayFillElement(
  initializer: Expression,
  elementType: Str,
  index: IntLiteralValue,
  context: EmitContext,
): Str {
  if (initializer.kind !== "ArrowFunctionExpr") {
    return emitExpressionExpected(initializer, elementType, context);
  }
  const param = initializer.params[0] ?? "";
  return emitExpressionExpected(
    replaceIdentifierWithIndex(initializer.body, param, index),
    elementType,
    context,
  );
}

function replaceIdentifierWithIndex(
  expr: Expression,
  name: Str,
  index: IntLiteralValue,
): Expression {
  if (expr.kind === "IdentifierExpr" && expr.name === name) {
    return { kind: "IntegerLiteral", value: index, text: index.toString(), span: expr.span };
  }
  switch (expr.kind) {
    case "UnaryExpr":
      return { ...expr, operand: replaceIdentifierWithIndex(expr.operand, name, index) };
    case "BinaryExpr":
      return {
        ...expr,
        left: replaceIdentifierWithIndex(expr.left, name, index),
        right: replaceIdentifierWithIndex(expr.right, name, index),
      };
    case "ConditionalExpr":
      return {
        ...expr,
        condition: replaceIdentifierWithIndex(expr.condition, name, index),
        whenTrue: replaceIdentifierWithIndex(expr.whenTrue, name, index),
        whenFalse: replaceIdentifierWithIndex(expr.whenFalse, name, index),
      };
    case "NullishCoalesceExpr":
      return {
        ...expr,
        left: replaceIdentifierWithIndex(expr.left, name, index),
        fallback: replaceIdentifierWithIndex(expr.fallback, name, index),
      };
    case "SatisfiesExpr":
      return { ...expr, expression: replaceIdentifierWithIndex(expr.expression, name, index) };
    case "CastExpr":
      return { ...expr, expression: replaceIdentifierWithIndex(expr.expression, name, index) };
    case "CallExpr":
      return {
        ...expr,
        args: expr.args.map((arg) => replaceIdentifierWithIndex(arg, name, index)),
      };
    case "MethodCallExpr":
      return {
        ...expr,
        receiver: replaceIdentifierWithIndex(expr.receiver, name, index),
        args: expr.args.map((arg) => replaceIdentifierWithIndex(arg, name, index)),
      };
    case "FieldAccessExpr":
      return { ...expr, operand: replaceIdentifierWithIndex(expr.operand, name, index) };
    case "IndexExpr":
      return {
        ...expr,
        operand: replaceIdentifierWithIndex(expr.operand, name, index),
        index: replaceIdentifierWithIndex(expr.index, name, index),
      };
    default:
      return expr;
  }
}

function emitCastExpression(
  expr: Extract<Expression, { kind: "CastExpr" }>,
  context: EmitContext,
): Str {
  return `((${emitCTypeName(expr.type, context.typeAliases)})${
    emitExpression(expr.expression, context)
  })`;
}

function emitExpectedOptionalConstructorExpression(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  context: EmitContext,
): Str | null {
  if (expr.callee !== "Some" && expr.callee !== "None") return null;
  const type = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "";
  const element = optionalTypeNameElement(type);
  if (element === null) return null;
  const optionalType = optionalCTypeNameFromTypeName(element);
  if (expr.callee === "None") return `(${optionalType}){ .present = false }`;
  const value = expr.args[0]
    ? emitExpressionExpected(expr.args[0], cTypeNameFromTypeName(element, context), context)
    : "0";
  return `(${optionalType}){ .present = true, .value = ${value} }`;
}

function cTypeNameFromTypeName(type: Str, context: EmitContext): Str {
  const alias = context.typeAliases.get(type);
  if (alias?.cName) return alias.cName;
  return type === "bool" ? "b8" : type;
}

function emitNewExpression(
  expr: Extract<Expression, { kind: "NewExpr" }>,
  context: EmitContext,
): Str {
  const constructorName = classConstructorName(expr.className);
  const fn = context.functions.get(constructorName);
  if (!fn) {
    return `${constructorName}(${expr.args.map((arg) => emitExpression(arg, context)).join(", ")})`;
  }
  const args = emitCallArguments(
    expr.args,
    fn.params,
    context,
    (arg, param) => emitNewArgument(arg, param, context),
    emitExpressionExpected,
  );
  return `${fn.cName ?? constructorName}(${args.join(", ")})`;
}

function emitNewArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize] | undefined,
  context: EmitContext,
): Str {
  if (!param) return emitExpression(arg, context);
  return emitExpressionExpected(arg, emitCTypeName(param.type, context.typeAliases), context);
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
  const arraySliceCall = emitArraySliceHelperCall(expr, receiverType, context);
  if (arraySliceCall !== null) return arraySliceCall;
  const borrowedCall = emitBorrowedInterfaceMethodCall(expr, receiverType, context);
  if (borrowedCall !== null) return borrowedCall;
  const methodName = classMethodName(classMethodReceiverType(receiverType), expr.method);
  const fn = context.functions.get(methodName);
  if (!fn) return `${methodName}()`;
  const args = [
    emitAddressOfReceiver(expr.receiver, context),
    ...emitCallArguments(
      expr.args,
      fn.params.slice(1),
      context,
      (arg, param) => emitMethodArgument(arg, param, context),
      emitExpressionExpected,
    ),
  ];
  return `${fn.cName ?? methodName}(${args.join(", ")})`;
}

function emitArraySliceHelperCall(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  receiverType: Str,
  context: EmitContext,
): Str | null {
  if (expr.method !== "slice") return null;
  const array = parseArrayTypeName(receiverType);
  if (array !== null) return emitArraySliceCall(expr, array.element, context);
  const slice = parseSliceTypeName(receiverType);
  if (slice !== null) return emitSliceSliceCall(expr, slice.element, context);
  return null;
}

function emitArraySliceCall(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  elementType: Str,
  context: EmitContext,
): Str {
  const receiver = emitMemberOperand(expr.receiver, context);
  return emitSliceLiteral(
    elementType,
    `${receiver} + ${emitExpression(expr.args[0]!, context)}`,
    expr,
    context,
  );
}

function emitSliceSliceCall(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  elementType: Str,
  context: EmitContext,
): Str {
  const receiver = emitMemberOperand(expr.receiver, context);
  return emitSliceLiteral(
    elementType,
    `${receiver}.data + ${emitExpression(expr.args[0]!, context)}`,
    expr,
    context,
  );
}

function emitSliceLiteral(
  elementType: Str,
  data: Str,
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  context: EmitContext,
): Str {
  const start = emitExpression(expr.args[0]!, context);
  const end = emitExpression(expr.args[1]!, context);
  return `(${sliceTypeName(elementType)}){ .data = ${data}, .length = ${end} - ${start} }`;
}

function sliceTypeName(elementType: Str): Str {
  return `Slice_${elementType.replace(/[^A-Za-z0-9_]/g, "_")}`;
}

function emitBorrowedInterfaceMethodCall(
  expr: Extract<Expression, { kind: "MethodCallExpr" }>,
  receiverType: Str,
  context: EmitContext,
): Str | null {
  const interfaceName = borrowedSourceName(receiverType);
  if (interfaceName === null) return null;
  const interfaceDecl =
    context.program?.interfaces?.find((candidate) => candidate.name === interfaceName) ?? null;
  if (interfaceDecl === null) return null;
  const method = interfaceDecl.methods.find((candidate) => candidate.name === expr.method) ?? null;
  if (method === null) return null;
  const receiver = emitExpression(expr.receiver, context);
  const args = emitCallArguments(
    expr.args,
    method.params,
    context,
    (arg, param) => emitMethodArgument(arg, param, context),
    emitExpressionExpected,
  );
  return `${receiver}.${expr.method}(${[`${receiver}.self`, ...args].join(", ")})`;
}

function emitAddressOfReceiver(expr: Expression, context: EmitContext): Str {
  const receiverType = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "<error>";
  if (receiverType.endsWith("*")) return emitMemberOperand(expr, context);
  return `&${emitMemberOperand(expr, context)}`;
}

function emitMethodArgument(
  arg: Expression,
  param: FunctionDecl["params"][usize] | undefined,
  context: EmitContext,
): Str {
  if (!param) return emitExpression(arg, context);
  return emitExpressionExpected(arg, emitCTypeName(param.type, context.typeAliases), context);
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
  const record = expectedRecordType(expectedType, context) ??
    inferredRecordLiteralType(expr, context);
  const fields = record === null
    ? []
    : record.fields.map((field) => emitRecordLiteralField(expr, field, context));
  return `(${expectedType}){ ${fields.join(", ")} }`;
}

function inferredRecordLiteralType(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  context: EmitContext,
): RecordTypeRef | null {
  const type = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "";
  return lookupRecordAlias(type, new Map());
}

function emitRecordLiteralField(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  field: RecordTypeRef["fields"][usize],
  context: EmitContext,
): Str {
  const value = emitRecordLiteralFieldValue(expr, field, context);
  return `.${field.name} = ${value}`;
}

function emitRecordLiteralFieldValue(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  field: RecordTypeRef["fields"][usize],
  context: EmitContext,
): Str {
  const entry = findRecordLiteralSource(expr, field.name, context);
  if (entry === null) return emitMissingRecordLiteralField(field);
  if (entry.kind === "Spread") {
    return `${emitMemberOperand(entry.expression, context)}.${field.name}`;
  }
  if (field.optional === true) {
    return emitOptionalRecordLiteralField(entry.expression, field, context);
  }
  const expected = emitCTypeName(field.type, context.typeAliases);
  if (field.type.kind === "FixedArrayTypeRef" && entry.expression.kind === "ZeroValueExpr") {
    return "{0}";
  }
  return emitExpressionExpected(entry.expression, expected, context);
}

function emitMissingRecordLiteralField(field: RecordTypeRef["fields"][usize]): Str {
  if (field.optional !== true) return "0";
  const element = optionalTypeElement(field.type);
  if (element === null) return "0";
  return `(${optionalCTypeNameFromTypeName(typeName(element))}){ .present = false }`;
}

function emitOptionalRecordLiteralField(
  expr: Expression,
  field: RecordTypeRef["fields"][usize],
  context: EmitContext,
): Str {
  const element = optionalTypeElement(field.type);
  if (element === null) return "0";
  const optionalType = optionalCTypeNameFromTypeName(typeName(element));
  if (isOptionalConstructor(expr)) return emitExpressionExpected(expr, optionalType, context);
  const expected = emitCTypeName(element, context.typeAliases);
  const value = emitExpressionExpected(expr, expected, context);
  return `(${optionalType}){ .present = true, .value = ${value} }`;
}

function isOptionalConstructor(expr: Expression): b8 {
  return expr.kind === "CallExpr" && (expr.callee === "Some" || expr.callee === "None");
}

function findRecordLiteralSource(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  fieldName: Str,
  context: EmitContext,
): Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize] | null {
  for (let index: usize = expr.fields.length; index > 0; index--) {
    const entry = expr.fields[index - 1]!;
    if (entry.kind !== "Spread" && entry.name === fieldName) return entry;
    if (entry.kind === "Spread" && spreadHasField(entry.expression, fieldName, context)) {
      return entry;
    }
  }
  return null;
}

function spreadHasField(expr: Expression, fieldName: Str, context: EmitContext): b8 {
  const type = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "<error>";
  const record = expectedRecordType(type, context);
  return record?.fields.some((field) => field.name === fieldName) ?? false;
}

function emitTupleLiteralExpression(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  elements: Str[],
  context: EmitContext,
): Str {
  const fields = expr.elements.map((element, index) =>
    `._${index} = ${emitExpressionExpected(element, elements[index] ?? "<error>", context)}`
  );
  return `(${tupleCTypeNameFromTypeNames(elements)}){ ${fields.join(", ")} }`;
}

function emitSliceArrayLiteralExpression(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str | null {
  if (parseSliceTypeName(expectedType) === null && !expectedType.startsWith("Slice_")) return null;
  const actualType = context.expressionTypes?.get(spanKey(expr.span))?.type ?? null;
  const array = actualType ? parseArrayTypeName(actualType) : null;
  if (array === null || array.length === null) return null;
  const values = emitArrayLiteralExpression(expr, context, `${array.element}[${array.length}]`);
  return `(${expectedType}){ .data = (${array.element}[])${values}, .length = ${array.length} }`;
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
  if (isTupleExpression(expr.operand, context) && expr.index.kind === "IntegerLiteral") {
    return `${operand}._${expr.index.text}`;
  }
  if (isSliceExpression(expr.operand, context)) return `${operand}.data[${index}]`;
  return `${operand}[${index}]`;
}

function isTupleExpression(expr: Expression, context: EmitContext): b8 {
  const type = context.expressionTypes?.get(spanKey(expr.span))?.type ?? null;
  return type !== null && parseTupleTypeName(type) !== null;
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
  if (isThisPointerFieldAccess(expr, receiverType)) return `this->${expr.field}`;
  return `${emitMemberOperand(expr.operand, context)}.${expr.field}`;
}

function emitQualifiedConstantExpression(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  context: EmitContext,
): Str | null {
  const name = qualifiedExpressionName(expr);
  return name === null ? null : context.constants?.get(name)?.cName ?? null;
}

function isThisPointerFieldAccess(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  receiverType: Str,
): b8 {
  return expr.operand.kind === "IdentifierExpr" && expr.operand.name === "this" &&
    (receiverType.endsWith("*") || receiverType.endsWith("&"));
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

function classMethodReceiverType(receiverType: Str): Str {
  if (receiverType.endsWith("*")) return receiverType.slice(0, -1);
  return receiverType;
}
