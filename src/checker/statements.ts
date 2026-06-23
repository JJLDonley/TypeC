import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type VarDeclStmt = Extract<Statement, { kind: "VarDeclStmt" }>;
type AssignmentStmt = Extract<Statement, { kind: "AssignmentStmt" }>;
type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;
type WhileStmt = Extract<Statement, { kind: "WhileStmt" }>;
type IfStmt = Extract<Statement, { kind: "IfStmt" }>;

export interface StatementCheckHandlers {
  returnStatement(expr: Expression | null, span: SourceSpan): void;
  deferStatement(expr: Expression, span: SourceSpan): void;
  expressionStatement(expr: Expression): void;
  breakStatement(span: SourceSpan): void;
  variableDeclaration(stmt: VarDeclStmt): void;
  assignment(stmt: AssignmentStmt): void;
  switchStatement(stmt: SwitchStmt): void;
  whileStatement(stmt: WhileStmt): void;
  ifStatement(stmt: IfStmt): void;
}

export function checkStatementDispatch(stmt: Statement, handlers: StatementCheckHandlers): void {
  switch (stmt.kind) {
    case "ReturnStmt":
      handlers.returnStatement(stmt.expression, stmt.span);
      return;
    case "DeferStmt":
      handlers.deferStatement(stmt.expression, stmt.span);
      return;
    case "ExpressionStmt":
      handlers.expressionStatement(stmt.expression);
      return;
    case "BreakStmt":
      handlers.breakStatement(stmt.span);
      return;
    case "VarDeclStmt":
      handlers.variableDeclaration(stmt);
      return;
    case "AssignmentStmt":
      handlers.assignment(stmt);
      return;
    case "SwitchStmt":
      handlers.switchStatement(stmt);
      return;
    case "WhileStmt":
      handlers.whileStatement(stmt);
      return;
    case "IfStmt":
      handlers.ifStatement(stmt);
      return;
  }
}
