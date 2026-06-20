import type { Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression } from "emitter/expressions.ts";

type Str = string;

type ExpressionStatement = Extract<Statement, { kind: "ExpressionStmt" }>;

export function emitExpressionStatement(stmt: ExpressionStatement, context: EmitContext): Str {
  return `${emitExpression(stmt.expression, context)};`;
}
