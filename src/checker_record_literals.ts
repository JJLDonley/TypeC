import type { Diagnostic } from "./diagnostics.ts";
import type { Expression, RecordTypeRef } from "./ast.ts";
import type { TypeName } from "./tast.ts";

type Str = string;
type usize = number;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type RecordLiteralField = RecordLiteralExpr["fields"][usize];

export function checkRecordLiteralTarget(record: RecordTypeRef | null, expected: TypeName, expr: RecordLiteralExpr): Diagnostic[] {
  if (record) return [];
  return [{ message: `Record literal is not assignable to non-record type '${expected}'`, span: expr.span }];
}

export function checkRecordLiteralFieldName(field: RecordLiteralField, record: RecordTypeRef, expected: TypeName, seen: Set<Str>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (seen.has(field.name)) diagnostics.push({ message: `Duplicate field '${field.name}'`, span: field.span });
  seen.add(field.name);
  if (!record.fields.some((candidate) => candidate.name === field.name)) diagnostics.push({ message: `Unknown field '${field.name}' on type '${expected}'`, span: field.span });
  return diagnostics;
}

export function checkRecordLiteralMissingFields(expr: RecordLiteralExpr, record: RecordTypeRef, expected: TypeName, seen: Set<Str>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const field of record.fields) {
    if (!seen.has(field.name)) diagnostics.push({ message: `Missing field '${field.name}' on type '${expected}'`, span: expr.span });
  }
  return diagnostics;
}

export function findRecordField(record: RecordTypeRef, name: Str): RecordTypeRef["fields"][usize] | null {
  return record.fields.find((candidate) => candidate.name === name) ?? null;
}
