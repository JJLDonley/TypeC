import type { Statement } from "core/ast.ts";
import { emitAssignment, type LocalTypes } from "emitter/assignments.ts";
import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { emitVarDecl } from "emitter/var_declarations.ts";

type Str = string;

export function emitStatement(
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes = new Map(),
): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression
        ? `return ${emitExpressionExpected(stmt.expression, returnType, context)};`
        : "return;";
    case "ExpressionStmt":
      return `${emitExpression(stmt.expression, context)};`;
    case "VarDeclStmt":
      locals.set(stmt.name, emitCTypeName(stmt.type, context.typeAliases));
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return emitAssignment(stmt, context, locals);
    case "WhileStmt":
      return emitWhile(stmt, returnType, context, locals);
    case "IfStmt":
      return emitIf(stmt, returnType, context, locals);
  }
}

function emitIf(
  stmt: Extract<Statement, { kind: "IfStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const header = `if (${emitExpression(stmt.condition, context)}) {`;
  const thenBody = emitChildStatements(stmt.thenBody.statements, returnType, context, locals);
  if (!stmt.elseBody) return emitBracedBlock(header, thenBody);
  const elseBody = emitChildStatements(stmt.elseBody.statements, returnType, context, locals);
  return emitIfElseBlock(header, thenBody, elseBody);
}

function emitWhile(
  stmt: Extract<Statement, { kind: "WhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const body = emitChildStatements(stmt.body.statements, returnType, context, locals);
  return emitBracedBlock(`while (${emitExpression(stmt.condition, context)}) {`, body);
}

function emitChildStatements(
  statements: Statement[],
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  const childLocals = new Map(locals);
  return statements.map((child) => emitStatement(child, returnType, context, childLocals));
}
