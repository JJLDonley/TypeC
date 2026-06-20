import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitIf, emitWhile } from "emitter/control_flow.ts";
import type { EmitContext } from "emitter/context.ts";
import { createEmitContext } from "emitter/context.ts";

type Str = string;
type BoolText = "true" | "false";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits while statements", () => {
  assertText(
    emitWhile(
      whileStmt(bool("true"), [returnStmt(int("1"))]),
      "i32",
      context(),
      new Map(),
      emitStatement,
    ),
    "while (true) {\n    return 1;\n  }",
  );
});

Deno.test("emits if else statements", () => {
  assertText(
    emitIf(
      ifStmt(bool("false"), [returnStmt(int("1"))], [returnStmt(int("2"))]),
      "i32",
      context(),
      new Map(),
      emitStatement,
    ),
    "if (false) {\n    return 1;\n  } else {\n    return 2;\n  }",
  );
});

function emitStatement(stmt: Statement): Str {
  if (stmt.kind === "ReturnStmt" && stmt.expression?.kind === "IntegerLiteral") {
    return `return ${stmt.expression.text};`;
  }
  throw new Error("Unsupported test statement");
}

function whileStmt(
  condition: Expression,
  statements: Statement[],
): Extract<Statement, { kind: "WhileStmt" }> {
  return { kind: "WhileStmt", condition, body: block(statements), span };
}

function ifStmt(
  condition: Expression,
  thenStatements: Statement[],
  elseStatements: Statement[],
): Extract<Statement, { kind: "IfStmt" }> {
  return {
    kind: "IfStmt",
    condition,
    thenBody: block(thenStatements),
    elseBody: block(elseStatements),
    span,
  };
}

function block(statements: Statement[]) {
  return { kind: "BlockStmt" as const, statements, span };
}

function returnStmt(expression: Expression): Statement {
  return { kind: "ReturnStmt", expression, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function bool(text: BoolText): Expression {
  return { kind: "BoolLiteral", value: text === "true", text, span };
}

function context(): EmitContext {
  return createEmitContext({
    kind: "Program",
    imports: [],
    typeAliases: [],
    functions: [],
    span,
    symbols: [],
    scopes: [],
    expressionTypes: new Map(),
  });
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
