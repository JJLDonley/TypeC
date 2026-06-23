import type { Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import type { LocalTypes } from "emitter/local_types.ts";

type Str = string;

type AssignmentStatement = Extract<Statement, { kind: "AssignmentStmt" }>;

function emitAssignmentOperator(operator: AssignmentStatement["operator"]): Str {
  return operator === ">>>=" ? ">>=" : operator;
}

export function emitAssignment(
  stmt: AssignmentStatement,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const targetType = locals.get(stmt.name);
  const expression = targetType
    ? emitExpressionExpected(stmt.expression, targetType, context)
    : emitExpression(stmt.expression, context);
  return `${stmt.name} ${emitAssignmentOperator(stmt.operator)} ${expression};`;
}
