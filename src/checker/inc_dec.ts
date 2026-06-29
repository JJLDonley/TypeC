import type { Statement } from "core/ast.ts";
import {
  ASSIGNMENT_ARRAY_TARGET,
  ASSIGNMENT_CONST_TARGET,
  INC_DEC_INTEGER_TARGET,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { AssignmentTargetInfo } from "checker/assignment_targets.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { isIntegerType } from "checker/types.ts";

type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;

export function checkIncDec(stmt: IncDecStmt, target: AssignmentTargetInfo | null): Diagnostic[] {
  if (!target) return [];
  const diagnostics: Diagnostic[] = [];
  if (!target.mutable) {
    diagnostics.push({
      message: `Cannot assign to const '${target.rootName}'`,
      code: ASSIGNMENT_CONST_TARGET,
      span: stmt.span,
    });
  }
  if (target.wholeLocal && parseArrayTypeName(target.type)) {
    diagnostics.push({
      message: `Cannot assign to array variable '${target.rootName}'`,
      code: ASSIGNMENT_ARRAY_TARGET,
      span: stmt.span,
    });
  }
  if (!isIntegerType(target.type)) {
    diagnostics.push({
      message: `Operator '${stmt.operator}' requires an integer target`,
      code: INC_DEC_INTEGER_TARGET,
      span: stmt.span,
    });
  }
  return diagnostics;
}
