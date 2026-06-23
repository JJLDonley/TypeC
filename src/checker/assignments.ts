import type { Diagnostic } from "core/diagnostics.ts";
import type { AssignmentOperator, Expression, Statement } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { checkBinaryOperation } from "checker/binary_operations.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;

type AssignmentStmt = Extract<Statement, { kind: "AssignmentStmt" }>;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkAssignment(
  stmt: AssignmentStmt,
  local: LocalInfo | undefined,
  resolveType: TypeResolver,
): Diagnostic[] {
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
  const operation = checkAssignmentOperation(stmt, local.type, resolveType);
  diagnostics.push(...operation.diagnostics);
  if (operation.type !== "<error>" && !isAssignable(operation.type, local.type)) {
    diagnostics.push({
      message: `Assignment type '${operation.type}' is not assignable to '${local.type}'`,
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
    left: { kind: "IdentifierExpr", name: stmt.name, span: stmt.span },
    right: stmt.expression,
    span: stmt.span,
  };
}

function binaryOperator(operator: AssignmentOperator): Str {
  return operator.slice(0, -1);
}
