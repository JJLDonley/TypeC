import type { Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";

type Str = string;

type ReturnStatement = Extract<Statement, { kind: "ReturnStmt" }>;

export function emitReturnStatement(
  stmt: ReturnStatement,
  returnType: Str,
  context: EmitContext,
): Str {
  if (stmt.expression === null) return "return;";
  return `return ${emitExpressionExpected(stmt.expression, returnType, context)};`;
}
