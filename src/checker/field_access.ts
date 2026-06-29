import {
  FIELD_ACCESS_RESTRICTED,
  FIELD_NON_RECORD,
  UNKNOWN_FIELD_ACCESS,
} from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { RecordTypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type usize = number;

export interface FieldAccessContext {
  currentClass: Str | null;
  ownerType: Str;
}

export interface FieldAccessCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

export function checkFieldAccess(
  record: RecordTypeRef | null,
  operand: TypeName,
  fieldName: Str,
  span: SourceSpan,
  context: FieldAccessContext | null = null,
): FieldAccessCheck {
  if (!record) return missingRecord(operand, fieldName, span);
  const field = record.fields.find((candidate) => candidate.name === fieldName);
  if (!field) return missingField(operand, fieldName, span);
  return {
    type: typeName(field.type),
    diagnostics: accessDiagnostics(field, fieldName, span, context),
  };
}

function accessDiagnostics(
  field: RecordTypeRef["fields"][usize],
  fieldName: Str,
  span: SourceSpan,
  context: FieldAccessContext | null,
): Diagnostic[] {
  if (!context) return [];
  if ((field.access ?? "public") === "public") return [];
  if (context.currentClass === context.ownerType) return [];
  return [{
    message: `Field '${fieldName}' is ${field.access}`,
    code: FIELD_ACCESS_RESTRICTED,
    span,
  }];
}

function missingRecord(operand: TypeName, fieldName: Str, span: SourceSpan): FieldAccessCheck {
  return {
    type: "<error>",
    diagnostics: [{
      message: `Cannot access field '${fieldName}' on non-record type '${operand}'`,
      code: FIELD_NON_RECORD,
      span,
    }],
  };
}

function missingField(operand: TypeName, fieldName: Str, span: SourceSpan): FieldAccessCheck {
  return {
    type: "<error>",
    diagnostics: [{
      message: `Unknown field '${fieldName}' on type '${operand}'`,
      code: UNKNOWN_FIELD_ACCESS,
      span,
    }],
  };
}
