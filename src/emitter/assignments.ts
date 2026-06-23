import type { AssignmentTarget, Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { spanKey } from "checker/exprs.ts";
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
  const targetType = assignmentTargetType(stmt.target, context, locals);
  const expression = targetType
    ? emitExpressionExpected(stmt.expression, targetType, context)
    : emitExpression(stmt.expression, context);
  return `${emitExpression(stmt.target, context)} ${
    emitAssignmentOperator(stmt.operator)
  } ${expression};`;
}

function assignmentTargetType(
  target: AssignmentTarget,
  context: EmitContext,
  locals: LocalTypes,
): Str | null {
  if (target.kind === "IdentifierExpr") return locals.get(target.name) ?? null;
  return context.expressionTypes?.get(spanKey(target.span))?.type ?? null;
}
