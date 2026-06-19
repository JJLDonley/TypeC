import type { Statement } from "../ast.ts";

type b8 = boolean;

export function blockReturns(statements: Statement[]): b8 {
  return statements.some(statementReturns);
}

function statementReturns(statement: Statement): b8 {
  if (statement.kind === "ReturnStmt") return true;
  if (statement.kind !== "IfStmt") return false;
  if (!statement.elseBody) return false;
  return blockReturns(statement.thenBody.statements) && blockReturns(statement.elseBody.statements);
}
