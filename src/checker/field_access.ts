import type { Diagnostic, SourceSpan } from "../diagnostics.ts";
import type { RecordTypeRef } from "../ast.ts";
import type { TypeName } from "../tast.ts";
import { typeName } from "../type_ref.ts";

type Str = string;

export interface FieldAccessCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

export function checkFieldAccess(record: RecordTypeRef | null, operand: TypeName, fieldName: Str, span: SourceSpan): FieldAccessCheck {
  if (!record) return missingRecord(operand, fieldName, span);
  const field = record.fields.find((candidate) => candidate.name === fieldName);
  if (!field) return missingField(operand, fieldName, span);
  return { type: typeName(field.type), diagnostics: [] };
}

function missingRecord(operand: TypeName, fieldName: Str, span: SourceSpan): FieldAccessCheck {
  return {
    type: "<error>",
    diagnostics: [{ message: `Cannot access field '${fieldName}' on non-record type '${operand}'`, span }],
  };
}

function missingField(operand: TypeName, fieldName: Str, span: SourceSpan): FieldAccessCheck {
  return {
    type: "<error>",
    diagnostics: [{ message: `Unknown field '${fieldName}' on type '${operand}'`, span }],
  };
}
