import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkStatementDispatch, type StatementCheckHandlers } from "checker/statements.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("dispatches statement checks", () => {
  assertDispatch(returnStmt(), "return");
  assertDispatch(expressionStmt(), "expression");
  assertDispatch(breakStmt(), "break");
  assertDispatch(varDecl(), "var");
  assertDispatch(assignment(), "assign");
  assertDispatch(switchStmt(), "switch");
  assertDispatch(whileStmt(), "while");
  assertDispatch(ifStmt(), "if");
});

function assertDispatch(stmt: Statement, expected: Str): void {
  const calls: Str[] = [];
  checkStatementDispatch(stmt, handlers(calls));
  assertText(calls[0] ?? "", expected);
  assertLen(calls.length, 1);
}

function handlers(calls: Str[]): StatementCheckHandlers {
  return {
    returnStatement: () => calls.push("return"),
    expressionStatement: () => calls.push("expression"),
    breakStatement: () => calls.push("break"),
    variableDeclaration: () => calls.push("var"),
    assignment: () => calls.push("assign"),
    switchStatement: () => calls.push("switch"),
    whileStatement: () => calls.push("while"),
    ifStatement: () => calls.push("if"),
  };
}

function returnStmt(): Statement {
  return { kind: "ReturnStmt", expression: null, span };
}

function expressionStmt(): Statement {
  return { kind: "ExpressionStmt", expression: call(), span };
}

function breakStmt(): Statement {
  return { kind: "BreakStmt", span };
}

function varDecl(): Statement {
  return {
    kind: "VarDeclStmt",
    mutable: false,
    name: "x",
    type: named("i32"),
    initializer: integer("1"),
    span,
  };
}

function assignment(): Statement {
  return { kind: "AssignmentStmt", name: "x", expression: integer("1"), span };
}

function switchStmt(): Statement {
  return {
    kind: "SwitchStmt",
    expression: integer("1"),
    cases: [{ labels: [integer("1")], statements: [], span }],
    defaultCase: null,
    span,
  };
}

function whileStmt(): Statement {
  return { kind: "WhileStmt", condition: boolLiteral(), body: block(), span };
}

function ifStmt(): Statement {
  return { kind: "IfStmt", condition: boolLiteral(), thenBody: block(), elseBody: null, span };
}

function block(): Extract<Statement, { kind: "WhileStmt" }>["body"] {
  return { kind: "BlockStmt", statements: [], span };
}

function call(): Expression {
  return { kind: "CallExpr", callee: "tick", args: [], span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function boolLiteral(): Expression {
  return { kind: "BoolLiteral", value: true, text: "true", span };
}

function named(name: Str): Extract<Statement, { kind: "VarDeclStmt" }>["type"] {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
