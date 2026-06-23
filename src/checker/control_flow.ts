import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression, Statement } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { checkIfCondition, checkWhileCondition } from "checker/conditions.ts";

type Str = string;

type IfStmt = Extract<Statement, { kind: "IfStmt" }>;
type WhileStmt = Extract<Statement, { kind: "WhileStmt" }>;
type DoWhileStmt = Extract<Statement, { kind: "DoWhileStmt" }>;
type TypeResolver = (expr: Expression) => TypeName;
type BlockChecker = (statements: Statement[], locals: Map<Str, LocalInfo>) => Diagnostic[];

export function checkWhileStatement(
  stmt: WhileStmt,
  locals: Map<Str, LocalInfo>,
  resolveType: TypeResolver,
  checkBlock: BlockChecker,
): Diagnostic[] {
  return checkLoop(stmt.condition, stmt.body.statements, locals, resolveType, checkBlock);
}

export function checkDoWhileStatement(
  stmt: DoWhileStmt,
  locals: Map<Str, LocalInfo>,
  resolveType: TypeResolver,
  checkBlock: BlockChecker,
): Diagnostic[] {
  return checkLoop(stmt.condition, stmt.body.statements, locals, resolveType, checkBlock);
}

function checkLoop(
  conditionExpr: Expression,
  statements: Statement[],
  locals: Map<Str, LocalInfo>,
  resolveType: TypeResolver,
  checkBlock: BlockChecker,
): Diagnostic[] {
  const condition = resolveType(conditionExpr);
  return [
    ...checkWhileCondition(condition, conditionExpr.span),
    ...checkBlock(statements, locals),
  ];
}

export function checkIfStatement(
  stmt: IfStmt,
  locals: Map<Str, LocalInfo>,
  resolveType: TypeResolver,
  checkBlock: BlockChecker,
): Diagnostic[] {
  const condition = resolveType(stmt.condition);
  const diagnostics: Diagnostic[] = checkIfCondition(condition, stmt.condition.span);
  diagnostics.push(...checkBlock(stmt.thenBody.statements, locals));
  if (stmt.elseBody) diagnostics.push(...checkBlock(stmt.elseBody.statements, locals));
  return diagnostics;
}
