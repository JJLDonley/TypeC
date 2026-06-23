import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { checkRecordLiteralFields } from "checker/record_literal_fields.ts";
import { checkRecordLiteralTarget } from "checker/record_literals.ts";

type Str = string;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface RecordLiteralExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkRecordLiteralExpression(
  expr: RecordLiteralExpr,
  expected: TypeName,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
): RecordLiteralExpressionCheck {
  const record = lookupRecordAlias(expected, aliases);
  const diagnostics = checkRecordLiteralTarget(record, expected, expr);
  if (!record) return { diagnostics, type: "<error>" };
  diagnostics.push(...checkRecordLiteralFields(expr, record, expected, resolveExpectedType));
  return { diagnostics, type: expected };
}
