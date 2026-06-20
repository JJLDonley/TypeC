import type { Statement } from "core/ast.ts";
import type { LocalTypes } from "emitter/assignments.ts";
import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression } from "emitter/expressions.ts";

type Str = string;

type StatementEmitter = (
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
) => Str;

export function emitIf(
  stmt: Extract<Statement, { kind: "IfStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  emitStatement: StatementEmitter,
): Str {
  const header = `if (${emitExpression(stmt.condition, context)}) {`;
  const thenBody = emitChildStatements(
    stmt.thenBody.statements,
    returnType,
    context,
    locals,
    emitStatement,
  );
  if (!stmt.elseBody) return emitBracedBlock(header, thenBody);
  const elseBody = emitChildStatements(
    stmt.elseBody.statements,
    returnType,
    context,
    locals,
    emitStatement,
  );
  return emitIfElseBlock(header, thenBody, elseBody);
}

export function emitWhile(
  stmt: Extract<Statement, { kind: "WhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  emitStatement: StatementEmitter,
): Str {
  const body = emitChildStatements(
    stmt.body.statements,
    returnType,
    context,
    locals,
    emitStatement,
  );
  return emitBracedBlock(`while (${emitExpression(stmt.condition, context)}) {`, body);
}

function emitChildStatements(
  statements: Statement[],
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  emitStatement: StatementEmitter,
): Str[] {
  const childLocals = new Map(locals);
  return statements.map((child) => emitStatement(child, returnType, context, childLocals));
}
