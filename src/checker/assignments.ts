import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression, Statement } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { isAssignable, parseArrayType } from "checker/types.ts";

type AssignmentStmt = Extract<Statement, { kind: "AssignmentStmt" }>;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkAssignment(stmt: AssignmentStmt, local: LocalInfo | undefined, resolveType: TypeResolver): Diagnostic[] {
  if (!local) return [];
  const diagnostics: Diagnostic[] = [];
  if (!local.mutable) diagnostics.push({ message: `Cannot assign to const '${stmt.name}'`, span: stmt.span });
  if (parseArrayType(local.type)) diagnostics.push({ message: `Cannot assign to array variable '${stmt.name}'`, span: stmt.span });
  const actual = resolveType(stmt.expression, local.type);
  if (!isAssignable(actual, local.type)) diagnostics.push({ message: `Assignment type '${actual}' is not assignable to '${local.type}'`, span: stmt.span });
  return diagnostics;
}
