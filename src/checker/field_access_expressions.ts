import {
  ARRAY_FIELD_ACCESS,
  SLICE_FIELD_ACCESS,
  UNSIZED_ARRAY_LENGTH,
} from "core/diagnostic_codes.ts";
import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkFieldAccess } from "checker/field_access.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import {
  isPointerLikeTypeName,
  parseArrayTypeName,
  parseSliceTypeName,
  pointeeTypeName,
} from "checker/type_name_shapes.ts";

type Str = string;
type IntLiteralValue = bigint;

type FieldAccessExpr = Extract<Expression, { kind: "FieldAccessExpr" }>;

export interface FieldAccessExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkFieldAccessExpression(
  expr: FieldAccessExpr,
  operandType: TypeName,
  aliases: Map<Str, TypeRef>,
  currentClass: Str | null = null,
): FieldAccessExpressionCheck {
  const arrayField = checkArrayFieldAccess(expr, operandType);
  if (arrayField) return arrayField;
  const sliceField = checkSliceFieldAccess(expr, operandType);
  if (sliceField) return sliceField;
  const thisField = checkThisPointerFieldAccess(expr, operandType, aliases, currentClass);
  if (thisField) return thisField;
  return checkFieldAccess(
    lookupRecordAlias(operandType, aliases),
    operandType,
    expr.field,
    expr.span,
    { currentClass, ownerType: operandType },
  );
}

function checkThisPointerFieldAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
  aliases: Map<Str, TypeRef>,
  currentClass: Str | null,
): FieldAccessExpressionCheck | null {
  if (expr.operand.kind !== "IdentifierExpr" || expr.operand.name !== "this") return null;
  if (!isPointerLikeTypeName(operandType)) return null;
  const recordType = pointeeTypeName(operandType);
  return checkFieldAccess(
    lookupRecordAlias(recordType, aliases),
    recordType,
    expr.field,
    expr.span,
    { currentClass, ownerType: recordType },
  );
}

function checkArrayFieldAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
): FieldAccessExpressionCheck | null {
  const array = parseArrayTypeName(operandType);
  if (array === null) return null;
  if (expr.field === "data") return { diagnostics: [], type: `${array.element}*` };
  if (expr.field === "length()") return checkArrayLengthAccess(expr, operandType, array.length);
  return {
    diagnostics: [{
      message: `Cannot access field '${expr.field}' on array type '${operandType}'`,
      code: ARRAY_FIELD_ACCESS,
      span: expr.span,
    }],
    type: "<error>",
  };
}

function checkSliceFieldAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
): FieldAccessExpressionCheck | null {
  const slice = parseSliceTypeName(operandType);
  if (slice === null) return null;
  if (expr.field === "data") return { diagnostics: [], type: `${slice.element}*` };
  if (expr.field === "length()") return { diagnostics: [], type: "usize" };
  return {
    diagnostics: [{
      message: `Cannot access field '${expr.field}' on slice type '${operandType}'`,
      code: SLICE_FIELD_ACCESS,
      span: expr.span,
    }],
    type: "<error>",
  };
}

function checkArrayLengthAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
  length: IntLiteralValue | null,
): FieldAccessExpressionCheck {
  if (length !== null) return { diagnostics: [], type: "usize" };
  return {
    diagnostics: [{
      message: `Array length is unavailable for unsized array type '${operandType}'`,
      code: UNSIZED_ARRAY_LENGTH,
      span: expr.span,
    }],
    type: "<error>",
  };
}
