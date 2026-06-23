import type { Statement } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { AssignmentTargetInfo } from "checker/assignment_targets.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { isIntegerType } from "checker/types.ts";

type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;

export function checkIncDec(stmt: IncDecStmt, target: AssignmentTargetInfo | null): Diagnostic[] {
  if (!target) return [];
  const diagnostics: Diagnostic[] = [];
  if (!target.mutable) {
    diagnostics.push({ message: `Cannot assign to const '${target.rootName}'`, span: stmt.span });
  }
  if (target.wholeLocal && parseArrayTypeName(target.type)) {
    diagnostics.push({
      message: `Cannot assign to array variable '${target.rootName}'`,
      span: stmt.span,
    });
  }
  if (!isIntegerType(target.type)) {
    diagnostics.push({
      message: `Operator '${stmt.operator}' requires an integer target`,
      span: stmt.span,
    });
  }
  return diagnostics;
}
