import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkFieldAccess } from "checker/field_access.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";

type Str = string;

type FieldAccessExpr = Extract<Expression, { kind: "FieldAccessExpr" }>;

export interface FieldAccessExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkFieldAccessExpression(expr: FieldAccessExpr, operandType: TypeName, aliases: Map<Str, TypeRef>): FieldAccessExpressionCheck {
  return checkFieldAccess(lookupRecordAlias(operandType, aliases), operandType, expr.field, expr.span);
}
