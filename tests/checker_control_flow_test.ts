import type { Expression, Statement } from "core/ast.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import {
  checkDoWhileStatement,
  checkIfStatement,
  checkWhileStatement,
} from "checker/control_flow.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};
const locals = new Map<Str, LocalInfo>();

Deno.test("checks valid control flow", () => {
  assertLen(checkWhileStatement(whileStmt(bool()), locals, resolveBool, emptyBlock).length, 0);
  assertLen(checkDoWhileStatement(doWhileStmt(bool()), locals, resolveBool, emptyBlock).length, 0);
  assertLen(checkIfStatement(ifStmt(bool()), locals, resolveBool, emptyBlock).length, 0);
});

Deno.test("reports invalid control flow conditions", () => {
  assertText(
    checkWhileStatement(whileStmt(integer()), locals, resolveI32, emptyBlock)[0]?.message ?? "",
    "While condition type 'i32' is not assignable to 'bool'",
  );
  assertText(
    checkDoWhileStatement(doWhileStmt(integer()), locals, resolveI32, emptyBlock)[0]?.message ?? "",
    "While condition type 'i32' is not assignable to 'bool'",
  );
  assertText(
    checkIfStatement(ifStmt(integer()), locals, resolveI32, emptyBlock)[0]?.message ?? "",
    "If condition type 'i32' is not assignable to 'bool'",
  );
});

function emptyBlock(_statements: Statement[], _locals: Map<Str, LocalInfo>): Diagnostic[] {
  return [];
}

function resolveBool(_expr: Expression): TypeName {
  return "bool";
}

function resolveI32(_expr: Expression): TypeName {
  return "i32";
}

function whileStmt(condition: Expression): Extract<Statement, { kind: "WhileStmt" }> {
  return { kind: "WhileStmt", condition, body: { kind: "BlockStmt", statements: [], span }, span };
}

function doWhileStmt(condition: Expression): Extract<Statement, { kind: "DoWhileStmt" }> {
  return {
    kind: "DoWhileStmt",
    body: { kind: "BlockStmt", statements: [], span },
    condition,
    span,
  };
}

function ifStmt(condition: Expression): Extract<Statement, { kind: "IfStmt" }> {
  return {
    kind: "IfStmt",
    condition,
    thenBody: { kind: "BlockStmt", statements: [], span },
    elseBody: null,
    span,
  };
}

function bool(): Expression {
  return { kind: "BoolLiteral", value: true, text: "true", span };
}

function integer(): Expression {
  return { kind: "IntegerLiteral", value: 1n, text: "1", span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
