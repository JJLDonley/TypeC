import type { BlockStmt, FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { blockReturns, checkMissingFunctionReturn } from "checker/returns.ts";

type Str = string;
type b8 = boolean;
type usize = number;

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

Deno.test("reports missing function returns", () => {
  assertLen(checkMissingFunctionReturn(fn("main", named("i32"), block([])), "i32").length, 1);
  assertLen(checkMissingFunctionReturn(fn("noop", named("void"), block([])), "void").length, 0);
  assertLen(checkMissingFunctionReturn(fn("main", named("i32"), block([returnStmt()])), "i32").length, 0);
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

function fn(name: Str, returnType: TypeRef, body: BlockStmt): FunctionDecl {
  return { kind: "FunctionDecl", exported: false, external: false, name, params: [], returnType, body, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
