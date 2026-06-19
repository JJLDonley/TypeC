import type { SourceSpan } from "../src/diagnostics.ts";
import type { CastBlockStmt, CastExpression, CastStatement, CastTypeRef } from "../src/cast.ts";
import { lowerBlockStmt } from "../src/lower_statements.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("lowers block statements", () => {
  const block: CastBlockStmt = {
    kind: "BlockStmt",
    statements: [varDecl(), assignment(), whileStmt(), ifStmt(), returnStmt()],
    span,
  };

  assertText(lowerBlockStmt(block).statements.map((statement) => statement.kind).join(","), "VarDeclStmt,AssignmentStmt,WhileStmt,IfStmt,ReturnStmt");
});

function varDecl(): CastStatement {
  return { kind: "VarDeclStmt", mutable: false, name: "x", type: named("i32"), initializer: integer("1"), span };
}

function assignment(): CastStatement {
  return { kind: "AssignmentStmt", name: "x", expression: integer("2"), span };
}

function whileStmt(): CastStatement {
  return { kind: "WhileStmt", condition: bool(), body: block([returnStmt()]), span };
}

function ifStmt(): CastStatement {
  return { kind: "IfStmt", condition: bool(), thenBody: block([returnStmt()]), elseBody: block([returnStmt()]), span };
}

function returnStmt(): CastStatement {
  return { kind: "ReturnStmt", expression: null, span };
}

function block(statements: CastStatement[]): CastBlockStmt {
  return { kind: "BlockStmt", statements, span };
}

function integer(text: Str): CastExpression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function bool(): CastExpression {
  return { kind: "BoolLiteral", value: true, text: "true", span };
}

function named(name: Str): CastTypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
