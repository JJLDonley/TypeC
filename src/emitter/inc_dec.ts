import type { Statement } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression } from "emitter/expressions.ts";

type Str = string;

type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;

export function emitIncDec(stmt: IncDecStmt, context: EmitContext): Str {
  return `${emitExpression(stmt.target, context)}${stmt.operator};`;
}
