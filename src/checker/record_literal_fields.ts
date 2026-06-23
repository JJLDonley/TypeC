import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression, RecordTypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayInitializer } from "checker/array_initializers.ts";
import {
  checkRecordLiteralFieldName,
  checkRecordLiteralMissingFields,
  findRecordField,
} from "checker/record_literals.ts";
import { isAssignable } from "checker/types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type usize = number;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkRecordLiteralFields(
  expr: RecordLiteralExpr,
  record: RecordTypeRef,
  expected: TypeName,
  resolveType: TypeResolver,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<Str>();
  for (const field of expr.fields) {
    diagnostics.push(...checkRecordLiteralField(field, record, expected, seen, resolveType));
  }
  diagnostics.push(...checkRecordLiteralMissingFields(expr, record, expected, seen));
  return diagnostics;
}

function checkRecordLiteralField(
  field: RecordLiteralExpr["fields"][usize],
  record: RecordTypeRef,
  expected: TypeName,
  seen: Set<Str>,
  resolveType: TypeResolver,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = checkRecordLiteralFieldName(field, record, expected, seen);
  const expectedField = findRecordField(record, field.name);
  if (!expectedField) return diagnostics;
  const expectedType = typeName(expectedField.type);
  diagnostics.push(...checkArrayInitializer(field.expression, expectedType, field.span));
  const actual = resolveType(field.expression, expectedType);
  if (!isAssignable(actual, expectedType)) {
    diagnostics.push({
      message: `Field '${field.name}' type '${actual}' is not assignable to '${expectedType}'`,
      span: field.span,
    });
  }
  return diagnostics;
}
