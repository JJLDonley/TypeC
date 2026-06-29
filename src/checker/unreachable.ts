import type { Statement } from "core/ast.ts";
import { UNREACHABLE_CODE } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";

type b8 = boolean;

export function unreachableStatementDiagnostics(statements: Statement[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let unreachable: b8 = false;
  for (const statement of statements) {
    if (unreachable) {
      diagnostics.push({
        message: "Unreachable statement",
        code: UNREACHABLE_CODE,
        span: statement.span,
      });
    }
    if (statementTerminatesBlock(statement)) unreachable = true;
  }
  return diagnostics;
}

function statementTerminatesBlock(statement: Statement): b8 {
  if (statement.kind === "ReturnStmt") return true;
  if (statement.kind === "BreakStmt") return true;
  if (statement.kind === "ContinueStmt") return true;
  if (statement.kind === "IfStmt") return ifStatementTerminates(statement);
  if (statement.kind === "SwitchStmt") return switchStatementTerminates(statement);
  if (statement.kind === "DoWhileStmt") return blockTerminates(statement.body.statements);
  return false;
}

function ifStatementTerminates(statement: Extract<Statement, { kind: "IfStmt" }>): b8 {
  if (!statement.elseBody) return false;
  return blockTerminates(statement.thenBody.statements) &&
    blockTerminates(statement.elseBody.statements);
}

function switchStatementTerminates(statement: Extract<Statement, { kind: "SwitchStmt" }>): b8 {
  if (!statement.defaultCase) return false;
  return statement.cases.every((switchCase) => blockTerminatesSwitchArm(switchCase.statements)) &&
    blockTerminatesSwitchArm(statement.defaultCase.statements);
}

function blockTerminates(statements: Statement[]): b8 {
  return statements.some(statementTerminatesBlock);
}

function blockTerminatesSwitchArm(statements: Statement[]): b8 {
  return statements.some(statementTerminatesSwitchArm);
}

function statementTerminatesSwitchArm(statement: Statement): b8 {
  if (statement.kind === "BreakStmt") return false;
  return statementTerminatesBlock(statement);
}
