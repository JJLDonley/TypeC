import type { RecordField, RecordTypeRef, TypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { splitTopLevel } from "checker/type_name_shapes.ts";
import { typeRefFromTypeName } from "checker/type_name_type_refs.ts";

type Str = string;

export function lookupRecordAlias(
  name: TypeName,
  aliases: Map<Str, TypeRef>,
): RecordTypeRef | null {
  const type = aliases.get(name);
  if (type?.kind === "RecordTypeRef") return type;
  return parseRecordTypeName(name);
}

function parseRecordTypeName(name: TypeName): RecordTypeRef | null {
  if (!name.startsWith("{") || !name.endsWith("}")) return null;
  const body = name.slice(1, -1);
  if (body.trim().length === 0) return recordType([]);
  const fields = splitTopLevel(body, ";").map(parseRecordFieldName);
  if (fields.some((field) => field === null)) return null;
  return recordType(fields as RecordField[]);
}

function parseRecordFieldName(field: Str): RecordField | null {
  const parts = splitTopLevel(field, ":");
  if (parts.length !== 2) return null;
  const span = emptySpan();
  return {
    name: parts[0]!.trim(),
    type: typeRefFromTypeName(parts[1]!.trim(), span),
    span,
  };
}

function recordType(fields: RecordField[]): RecordTypeRef {
  return { kind: "RecordTypeRef", fields, span: emptySpan() };
}

function emptySpan(): RecordTypeRef["span"] {
  return {
    start: { offset: 0, line: 1, column: 1 },
    end: { offset: 0, line: 1, column: 1 },
  };
}
