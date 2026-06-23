import type { FunctionDecl, Statement } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";

type b8 = boolean;

export function checkMissingFunctionReturn(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  if (returnType === "void" || !fn.body || blockReturns(fn.body.statements)) return [];
  return [{ message: `Function '${fn.name}' must return '${returnType}'`, span: fn.span }];
}

export function blockReturns(statements: Statement[]): b8 {
  return statements.some(statementReturns);
}

function statementReturns(statement: Statement): b8 {
  if (statement.kind === "ReturnStmt") return true;
  if (statement.kind === "IfStmt") return ifStatementReturns(statement);
  if (statement.kind === "SwitchStmt") return switchStatementReturns(statement);
  return false;
}

function ifStatementReturns(statement: Extract<Statement, { kind: "IfStmt" }>): b8 {
  if (!statement.elseBody) return false;
  return blockReturns(statement.thenBody.statements) && blockReturns(statement.elseBody.statements);
}

function switchStatementReturns(statement: Extract<Statement, { kind: "SwitchStmt" }>): b8 {
  if (!statement.defaultCase) return false;
  return statement.cases.every((switchCase) => blockReturns(switchCase.statements)) &&
    blockReturns(statement.defaultCase.statements);
}
