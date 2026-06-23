import type { Statement } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { LocalInfo } from "checker/locals.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { isIntegerType } from "checker/types.ts";

type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;

export function checkIncDec(stmt: IncDecStmt, local: LocalInfo | undefined): Diagnostic[] {
  if (!local) return [];
  const diagnostics: Diagnostic[] = [];
  if (!local.mutable) {
    diagnostics.push({ message: `Cannot assign to const '${stmt.name}'`, span: stmt.span });
  }
  if (parseArrayTypeName(local.type)) {
    diagnostics.push({
      message: `Cannot assign to array variable '${stmt.name}'`,
      span: stmt.span,
    });
  }
  if (!isIntegerType(local.type)) {
    diagnostics.push({
      message: `Operator '${stmt.operator}' requires an integer target`,
      span: stmt.span,
    });
  }
  return diagnostics;
}
