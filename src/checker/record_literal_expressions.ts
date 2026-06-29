import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { checkRecordLiteralEntries } from "checker/record_literal_entries.ts";
import {
  checkRecordLiteralMissingFields,
  checkRecordLiteralTarget,
} from "checker/record_literals.ts";

type Str = string;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type TypeResolver = (expr: Expression) => TypeName;

export interface RecordLiteralExpressionCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkRecordLiteralExpression(
  expr: RecordLiteralExpr,
  expected: TypeName,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver = (value) => resolveExpectedType(value, "<error>"),
): RecordLiteralExpressionCheck {
  const record = lookupRecordAlias(expected, aliases);
  const diagnostics = checkRecordLiteralTarget(record, expected, expr);
  if (!record) return { diagnostics, type: "<error>" };
  const entries = checkRecordLiteralEntries(
    expr,
    record,
    expected,
    aliases,
    resolveExpectedType,
    resolveType,
  );
  diagnostics.push(...entries.diagnostics);
  diagnostics.push(...checkRecordLiteralMissingFields(expr, record, expected, entries.seen));
  return { diagnostics, type: expected };
}
