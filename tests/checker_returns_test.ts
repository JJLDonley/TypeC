import type { BlockStmt, Statement } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { blockReturns } from "checker/returns.ts";

type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("detects direct block returns", () => {
  assertSame(blockReturns([returnStmt()]), true);
  assertSame(blockReturns([assignmentStmt()]), false);
});

Deno.test("detects conditional block returns", () => {
  assertSame(blockReturns([ifStmt([returnStmt()], [returnStmt()])]), true);
  assertSame(blockReturns([ifStmt([returnStmt()], [assignmentStmt()])]), false);
  assertSame(blockReturns([ifStmt([returnStmt()], null)]), false);
});

function returnStmt(): Statement {
  return { kind: "ReturnStmt", expression: null, span };
}

function assignmentStmt(): Statement {
  return {
    kind: "AssignmentStmt",
    name: "x",
    expression: { kind: "IntegerLiteral", value: 1n, text: "1", span },
    span,
  };
}

function ifStmt(thenStatements: Statement[], elseStatements: Statement[] | null): Statement {
  return {
    kind: "IfStmt",
    condition: { kind: "BoolLiteral", value: true, text: "true", span },
    thenBody: block(thenStatements),
    elseBody: elseStatements === null ? null : block(elseStatements),
    span,
  };
}

function block(statements: Statement[]): BlockStmt {
  return { kind: "BlockStmt", statements, span };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
