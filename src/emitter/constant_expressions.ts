import type { ConstDecl, Expression, RecordTypeRef } from "core/ast.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";
import { cArrayElementType, emitIntegerLiteralExpression } from "emitter/helpers.ts";
import type { EmitContext } from "emitter/context.ts";
import { expectedRecordType } from "emitter/record_types.ts";
import { emitCStringLiteral, emitCStringPointer, emitCStringVoidPointer } from "emitter/strings.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;
type usize = number;

export function emitConstantExpressionExpected(
  expr: Expression,
  expectedType: Str,
  context: EmitContext,
): Str {
  switch (expr.kind) {
    case "IntegerLiteral":
      return emitIntegerLiteralExpression(expr, expectedType);
    case "FloatLiteral":
    case "BoolLiteral":
      return expr.text;
    case "StringLiteral":
      return emitConstantStringLiteral(expr, expectedType);
    case "IdentifierExpr":
      return emitConstantReference(expr.name, expectedType, context);
    case "UnaryExpr":
      return `${expr.operator}${emitConstantUnaryOperand(expr.operand, expectedType, context)}`;
    case "BinaryExpr":
      return emitConstantBinaryExpression(expr, expectedType, context);
    case "ConditionalExpr":
      return emitConstantConditionalExpression(expr, expectedType, context);
    case "RecordLiteralExpr":
      return emitConstantRecordLiteral(expr, expectedType, context);
    case "ArrayLiteralExpr":
      return emitConstantArrayLiteral(expr, expectedType, context);
    case "FieldAccessExpr":
      return emitQualifiedConstantReference(expr, expectedType, context);
    case "CallExpr":
    case "MethodCallExpr":
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
    case "NullishCoalesceExpr":
    case "IndexExpr":
      throw new Error("Unsupported compile-time constant expression");
  }
}

function emitConstantStringLiteral(
  expr: Extract<Expression, { kind: "StringLiteral" }>,
  expectedType: Str,
): Str {
  if (expectedType === "u8*") return emitCStringPointer(expr.text);
  if (expectedType === "void*") return emitCStringVoidPointer(expr.text);
  return emitCStringLiteral(expr.text);
}

function emitConstantReference(name: Str, expectedType: Str, context: EmitContext): Str {
  const constant = context.constants?.get(name) ?? null;
  if (constant === null) return name;
  return emitConstantInitializer(constant, expectedType, context);
}

function emitQualifiedConstantReference(
  expr: Extract<Expression, { kind: "FieldAccessExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const name = qualifiedExpressionName(expr);
  if (name === null) throw new Error("Unsupported constant field access");
  return emitConstantReference(name, expectedType, context);
}

function emitConstantInitializer(
  constant: ConstDecl,
  expectedType: Str,
  context: EmitContext,
): Str {
  const actualType = emitCTypeName(constant.type, context.typeAliases);
  return emitConstantExpressionExpected(constant.initializer, expectedType || actualType, context);
}

function emitConstantUnaryOperand(expr: Expression, expectedType: Str, context: EmitContext): Str {
  const operand = emitConstantExpressionExpected(expr, expectedType, context);
  if (
    expr.kind === "BinaryExpr" || expr.kind === "ConditionalExpr" ||
    expr.kind === "NullishCoalesceExpr"
  ) return `(${operand})`;
  return operand;
}

function emitConstantBinaryExpression(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const left = emitConstantExpressionExpected(expr.left, expectedType, context);
  const right = emitConstantExpressionExpected(expr.right, expectedType, context);
  return `${left} ${expr.operator} ${right}`;
}

function emitConstantConditionalExpression(
  expr: Extract<Expression, { kind: "ConditionalExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const condition = emitConstantExpressionExpected(expr.condition, "bool", context);
  const whenTrue = emitConstantExpressionExpected(expr.whenTrue, expectedType, context);
  const whenFalse = emitConstantExpressionExpected(expr.whenFalse, expectedType, context);
  return `${condition} ? ${whenTrue} : ${whenFalse}`;
}

function emitConstantRecordLiteral(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const record = expectedRecordType(expectedType, context);
  const fields = expr.fields.map((field) => emitConstantRecordField(field, record, context)).join(
    ", ",
  );
  return `(${expectedType}){ ${fields} }`;
}

function emitConstantRecordField(
  field: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize],
  record: RecordTypeRef | null,
  context: EmitContext,
): Str {
  const expected = record?.fields.find((candidate) => candidate.name === field.name);
  const expectedType = expected ? emitCTypeName(expected.type, context.typeAliases) : "";
  return `.${field.name} = ${
    emitConstantExpressionExpected(field.expression, expectedType, context)
  }`;
}

function emitConstantArrayLiteral(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  expectedType: Str,
  context: EmitContext,
): Str {
  const elementType = cArrayElementType(expectedType) ?? "";
  const elements = expr.elements.map((element) =>
    emitConstantExpressionExpected(element, elementType, context)
  );
  return `{ ${elements.join(", ")} }`;
}
