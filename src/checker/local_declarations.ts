import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression, Statement, TypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayInitializer } from "checker/array_initializers.ts";
import { checkInferredArrayLocalType } from "checker/inferred_array_local_types.ts";
import {
  checkInferredLocalType,
  normalizeInferredLocalType,
} from "checker/inferred_local_types.ts";
import { checkInferredRecordLocalType } from "checker/inferred_record_local_types.ts";
import { localDeclaredType } from "checker/local_types.ts";
import { isAssignable } from "checker/types.ts";
import { checkTypeRef } from "checker/type_validation.ts";
import { checkValueType } from "checker/value_types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type VarDeclStmt = Extract<Statement, { kind: "VarDeclStmt" }>;

export interface LocalDeclarationCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkLocalDeclaration(
  stmt: VarDeclStmt,
  typeAliases: Map<Str, TypeRef>,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  if (stmt.type === null) return checkInferredLocalDeclaration(stmt, resolveType);
  return checkAnnotatedLocalDeclaration(stmt, typeAliases, resolveType);
}

function checkAnnotatedLocalDeclaration(
  stmt: VarDeclStmt,
  typeAliases: Map<Str, TypeRef>,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  if (stmt.type === null) return { diagnostics: [], type: "<error>" };
  const expected = typeName(stmt.type);
  const diagnostics: Diagnostic[] = [
    ...checkTypeRef(stmt.type, typeAliases),
    ...checkValueType(stmt.type, `Variable '${stmt.name}' cannot have type 'void'`, stmt.span),
    ...checkArrayInitializer(stmt.initializer, expected, stmt.span),
  ];
  const actual = resolveType(stmt.initializer, expected);
  if (!isAssignable(actual, expected)) {
    diagnostics.push({
      message: `Initializer type '${actual}' is not assignable to '${expected}'`,
      span: stmt.span,
    });
  }
  return { diagnostics, type: localDeclaredType(expected, actual) };
}

function checkInferredLocalDeclaration(
  stmt: VarDeclStmt,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  if (stmt.initializer.kind === "ArrayLiteralExpr") {
    return checkInferredArrayLocalDeclaration(stmt.initializer, resolveType);
  }
  if (stmt.initializer.kind === "RecordLiteralExpr") {
    return checkInferredRecordLocalDeclaration(stmt.initializer, resolveType);
  }
  const actual = resolveType(stmt.initializer, "<infer>");
  const inferred = checkInferredLocalType(actual, stmt.span);
  return {
    diagnostics: inferred.diagnostics,
    type: inferred.inferable ? normalizeInferredLocalType(actual) : "<error>",
  };
}

function checkInferredArrayLocalDeclaration(
  initializer: Extract<VarDeclStmt["initializer"], { kind: "ArrayLiteralExpr" }>,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  const result = checkInferredArrayLocalType(
    initializer,
    (element) => normalizeInferredLocalType(resolveType(element, "<infer>")),
  );
  return { diagnostics: result.diagnostics, type: result.type };
}

function checkInferredRecordLocalDeclaration(
  initializer: Extract<VarDeclStmt["initializer"], { kind: "RecordLiteralExpr" }>,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  const result = checkInferredRecordLocalType(
    initializer,
    (field) => normalizeInferredLocalType(resolveType(field, "<infer>")),
  );
  return { diagnostics: result.diagnostics, type: result.type };
}
