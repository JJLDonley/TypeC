import type { Expression, RecordField, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";
import {
  checkInferredLocalType,
  normalizeInferredLocalType,
} from "checker/inferred_local_types.ts";
import { typeRefFromTypeName } from "checker/type_name_type_refs.ts";

export type Str = string;
type usize = number;

type RecordLiteralExpr = Extract<Expression, { kind: "RecordLiteralExpr" }>;
type FieldEntry = Extract<RecordLiteralExpr["fields"][usize], { kind?: "Field" }>;
type FieldTypeResolver = (expr: Expression) => TypeName;

export interface InferredRecordLocalTypeCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkInferredRecordLocalType(
  expr: RecordLiteralExpr,
  resolveFieldType: FieldTypeResolver,
): InferredRecordLocalTypeCheck {
  const fields = expr.fields.filter(isFieldEntry);
  if (fields.length !== expr.fields.length) {
    return {
      diagnostics: [{ message: "Cannot infer record type from spread fields", span: expr.span }],
      type: "<error>",
    };
  }
  const resolved = fields.map((field) => resolveField(field, resolveFieldType));
  return {
    diagnostics: resolved.flatMap((field) => field.diagnostics),
    type: recordTypeName(resolved.map((field) => field.recordField)),
  };
}

function resolveField(field: FieldEntry, resolveFieldType: FieldTypeResolver): {
  diagnostics: Diagnostic[];
  recordField: RecordField;
} {
  const actual = normalizeInferredLocalType(resolveFieldType(field.expression));
  const inferred = checkInferredLocalType(actual, field.span);
  return {
    diagnostics: inferred.diagnostics,
    recordField: {
      name: field.name,
      type: inferred.inferable
        ? typeRefFromTypeName(actual, field.span)
        : namedTypeRef("<error>", field.span),
      span: field.span,
    },
  };
}

function isFieldEntry(entry: RecordLiteralExpr["fields"][usize]): entry is FieldEntry {
  return entry.kind !== "Spread";
}

function recordTypeName(fields: RecordField[]): TypeName {
  return typeName({ kind: "RecordTypeRef", fields, span: emptySpan() });
}

function namedTypeRef(name: Str, span: RecordField["span"]): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function emptySpan(): RecordTypeRef["span"] {
  return {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
}
