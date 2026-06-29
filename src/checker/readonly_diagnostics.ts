import type { AssignmentTarget, Expression, TypeRef } from "core/ast.ts";
import { READONLY_FIELD_ASSIGNMENT } from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { isPointerLikeTypeName, pointeeTypeName } from "checker/type_name_shapes.ts";

type Str = string;

type TypeResolver = (expr: Expression) => TypeName;

export function readonlyAssignmentDiagnostics(
  target: AssignmentTarget,
  typeAliases: Map<Str, TypeRef>,
  resolveType: TypeResolver,
): Diagnostic[] {
  if (target.kind !== "FieldAccessExpr") return [];
  const field = readonlyField(target, typeAliases, resolveType);
  if (field === null) return [];
  return [{
    message: `Field '${target.field}' is readonly`,
    code: READONLY_FIELD_ASSIGNMENT,
    span: target.span,
    related: [{ message: `readonly field '${target.field}' declared here`, span: field.span }],
  }];
}

function readonlyField(
  target: Extract<AssignmentTarget, { kind: "FieldAccessExpr" }>,
  typeAliases: Map<Str, TypeRef>,
  resolveType: TypeResolver,
): { span: SourceSpan } | null {
  const operandType = resolveType(target.operand);
  const recordType = isPointerLikeTypeName(operandType)
    ? pointeeTypeName(operandType)
    : operandType;
  const record = lookupRecordAlias(recordType, typeAliases);
  return record?.fields.find((field) => field.name === target.field && field.readonly === true) ??
    null;
}
