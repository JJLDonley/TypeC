import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkFieldAccess } from "checker/field_access.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

type Str = string;

type FieldAccessExpr = Extract<Expression, { kind: "FieldAccessExpr" }>;

export interface FieldAccessExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkFieldAccessExpression(
  expr: FieldAccessExpr,
  operandType: TypeName,
  aliases: Map<Str, TypeRef>,
): FieldAccessExpressionCheck {
  const arrayField = checkArrayFieldAccess(expr, operandType);
  if (arrayField) return arrayField;
  return checkFieldAccess(
    lookupRecordAlias(operandType, aliases),
    operandType,
    expr.field,
    expr.span,
  );
}

function checkArrayFieldAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
): FieldAccessExpressionCheck | null {
  const array = parseArrayTypeName(operandType);
  if (array === null) return null;
  if (expr.field === "data") return { diagnostics: [], type: `${array.element}*` };
  return {
    diagnostics: [{
      message: `Cannot access field '${expr.field}' on array type '${operandType}'`,
      span: expr.span,
    }],
    type: "<error>",
  };
}
