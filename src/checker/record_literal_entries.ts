import type { Expression, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayInitializer } from "checker/array_initializers.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { findRecordField } from "checker/record_literals.ts";
import { isAssignable } from "checker/types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type usize = number;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type RecordLiteralEntry = RecordLiteralExpr["fields"][usize];
type RecordLiteralField = Extract<RecordLiteralEntry, { kind?: "Field" }>;
type RecordLiteralSpread = Extract<RecordLiteralEntry, { kind: "Spread" }>;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type TypeResolver = (expr: Expression) => TypeName;

export interface RecordLiteralEntryCheck {
  diagnostics: Diagnostic[];
  seen: Set<Str>;
}

export function checkRecordLiteralEntries(
  expr: RecordLiteralExpr,
  record: RecordTypeRef,
  expected: TypeName,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
): RecordLiteralEntryCheck {
  const diagnostics: Diagnostic[] = [];
  const seen = new Set<Str>();
  for (const entry of expr.fields) {
    diagnostics.push(...checkRecordLiteralEntry(entry, record, expected, aliases, resolveExpectedType, resolveType, seen));
  }
  return { diagnostics, seen };
}

function checkRecordLiteralEntry(
  entry: RecordLiteralEntry,
  record: RecordTypeRef,
  expected: TypeName,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
  seen: Set<Str>,
): Diagnostic[] {
  if (entry.kind === "Spread") {
    return checkSpreadEntry(entry, record, aliases, resolveExpectedType, resolveType, seen);
  }
  return checkFieldEntry(entry, record, expected, resolveExpectedType, seen);
}

function checkFieldEntry(
  field: RecordLiteralField,
  record: RecordTypeRef,
  expected: TypeName,
  resolveExpectedType: ExpectedTypeResolver,
  seen: Set<Str>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  seen.add(field.name);
  const target = findRecordField(record, field.name);
  if (target === null) {
    diagnostics.push({ message: `Unknown field '${field.name}' on type '${expected}'`, span: field.span });
    return diagnostics;
  }
  diagnostics.push(...checkArrayInitializer(field.expression, typeName(target.type), field.span));
  const actual = resolveExpectedType(field.expression, typeName(target.type));
  if (!isAssignable(actual, typeName(target.type))) {
    diagnostics.push({
      message: `Field '${field.name}' type '${actual}' is not assignable to '${typeName(target.type)}'`,
      span: field.span,
    });
  }
  return diagnostics;
}

function checkSpreadEntry(
  spread: RecordLiteralSpread,
  record: RecordTypeRef,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
  seen: Set<Str>,
): Diagnostic[] {
  const spreadType = resolveType(spread.expression);
  const spreadRecord = lookupRecordAlias(spreadType, aliases);
  if (spreadRecord === null) {
    return [{ message: `Record spread operand must be a record type, got '${spreadType}'`, span: spread.span }];
  }
  return spreadRecord.fields.flatMap((field) => {
    const target = findRecordField(record, field.name);
    if (target === null) return [];
    seen.add(field.name);
    const access: Expression = {
      kind: "FieldAccessExpr",
      operand: spread.expression,
      field: field.name,
      span: spread.span,
    };
    const actual = resolveExpectedType(access, typeName(target.type));
    if (isAssignable(actual, typeName(target.type))) return [];
    return [{
      message: `Spread field '${field.name}' type '${actual}' is not assignable to '${typeName(target.type)}'`,
      span: spread.span,
    }];
  });
}
