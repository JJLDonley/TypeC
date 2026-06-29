import {
  ASSIGNMENT_ARRAY_TARGET,
  ASSIGNMENT_CONST_TARGET,
  ASSIGNMENT_TYPE,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { AssignmentOperator, Expression, Statement } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import type { AssignmentTargetInfo } from "checker/assignment_targets.ts";
import { checkBinaryOperation } from "checker/binary_operations.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;

type AssignmentStmt = Extract<Statement, { kind: "AssignmentStmt" }>;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkAssignment(
  stmt: AssignmentStmt,
  target: AssignmentTargetInfo | null,
  resolveType: TypeResolver,
): Diagnostic[] {
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
  const operation = checkAssignmentOperation(stmt, target.type, resolveType);
  diagnostics.push(...operation.diagnostics);
  if (operation.type !== "<error>" && !isAssignable(operation.type, target.type)) {
    diagnostics.push({
      message: `Assignment type '${operation.type}' is not assignable to '${target.type}'`,
      code: ASSIGNMENT_TYPE,
      span: stmt.span,
    });
  }
  return diagnostics;
}

function checkAssignmentOperation(
  stmt: AssignmentStmt,
  localType: TypeName,
  resolveType: TypeResolver,
): { diagnostics: Diagnostic[]; type: TypeName } {
  if (stmt.operator === "=") {
    return { diagnostics: [], type: resolveType(stmt.expression, localType) };
  }
  return checkBinaryOperation(binaryExpression(stmt), {
    left: localType,
    right: resolveType(stmt.expression, localType),
  });
}

function binaryExpression(stmt: AssignmentStmt): Extract<Expression, { kind: "BinaryExpr" }> {
  return {
    kind: "BinaryExpr",
    operator: binaryOperator(stmt.operator),
    left: stmt.target,
    right: stmt.expression,
    span: stmt.span,
  };
}

function binaryOperator(operator: AssignmentOperator): Str {
  return operator.slice(0, -1);
}
