import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type VarDeclStmt = Extract<Statement, { kind: "VarDeclStmt" }>;
type RecordRestStmt = Extract<Statement, { kind: "RecordRestStmt" }>;
type ArrayDestructureStmt = Extract<Statement, { kind: "ArrayDestructureStmt" }>;
type AssignmentStmt = Extract<Statement, { kind: "AssignmentStmt" }>;
type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;
type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;
type WhileStmt = Extract<Statement, { kind: "WhileStmt" }>;
type DoWhileStmt = Extract<Statement, { kind: "DoWhileStmt" }>;
type ForStmt = Extract<Statement, { kind: "ForStmt" }>;
type ForOfStmt = Extract<Statement, { kind: "ForOfStmt" }>;
type ForInStmt = Extract<Statement, { kind: "ForInStmt" }>;
type IfStmt = Extract<Statement, { kind: "IfStmt" }>;

export interface StatementCheckHandlers {
  emptyStatement(span: SourceSpan): void;
  returnStatement(expr: Expression | null, span: SourceSpan): void;
  deferStatement(expr: Expression, span: SourceSpan): void;
  expressionStatement(expr: Expression): void;
  breakStatement(span: SourceSpan): void;
  continueStatement(span: SourceSpan): void;
  variableDeclaration(stmt: VarDeclStmt): void;
  recordRestDeclaration(stmt: RecordRestStmt): void;
  arrayDestructureDeclaration(stmt: ArrayDestructureStmt): void;
  assignment(stmt: AssignmentStmt): void;
  incDec(stmt: IncDecStmt): void;
  switchStatement(stmt: SwitchStmt): void;
  whileStatement(stmt: WhileStmt): void;
  doWhileStatement(stmt: DoWhileStmt): void;
  forStatement(stmt: ForStmt): void;
  forOfStatement(stmt: ForOfStmt): void;
  forInStatement(stmt: ForInStmt): void;
  ifStatement(stmt: IfStmt): void;
}

export function checkStatementDispatch(stmt: Statement, handlers: StatementCheckHandlers): void {
  switch (stmt.kind) {
    case "EmptyStmt":
      handlers.emptyStatement(stmt.span);
      return;
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
    case "ContinueStmt":
      handlers.continueStatement(stmt.span);
      return;
    case "VarDeclStmt":
      handlers.variableDeclaration(stmt);
      return;
    case "RecordRestStmt":
      handlers.recordRestDeclaration(stmt);
      return;
    case "ArrayDestructureStmt":
      handlers.arrayDestructureDeclaration(stmt);
      return;
    case "AssignmentStmt":
      handlers.assignment(stmt);
      return;
    case "IncDecStmt":
      handlers.incDec(stmt);
      return;
    case "SwitchStmt":
      handlers.switchStatement(stmt);
      return;
    case "WhileStmt":
      handlers.whileStatement(stmt);
      return;
    case "DoWhileStmt":
      handlers.doWhileStatement(stmt);
      return;
    case "ForStmt":
      handlers.forStatement(stmt);
      return;
    case "ForOfStmt":
      handlers.forOfStatement(stmt);
      return;
    case "ForInStmt":
      handlers.forInStatement(stmt);
      return;
    case "IfStmt":
      handlers.ifStatement(stmt);
      return;
  }
}
