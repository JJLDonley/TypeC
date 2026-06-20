import type { Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";

type Str = string;
export type LocalTypes = Map<Str, Str>;

type AssignmentStatement = Extract<Statement, { kind: "AssignmentStmt" }>;

export function emitAssignment(
  stmt: AssignmentStatement,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const targetType = locals.get(stmt.name);
  const expression = targetType
    ? emitExpressionExpected(stmt.expression, targetType, context)
    : emitExpression(stmt.expression, context);
  return `${stmt.name} = ${expression};`;
}
