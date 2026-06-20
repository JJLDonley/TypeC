import type { FunctionDecl, Statement, TypeAliasDecl } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitReturnStatement } from "emitter/return_statements.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits value returns", () => {
  assertText(emitReturnStatement(returnValue("7"), "i32", context()), "return 7;");
});

Deno.test("emits bare returns", () => {
  assertText(
    emitReturnStatement({ kind: "ReturnStmt", expression: null, span }, "void", context()),
    "return;",
  );
});

function returnValue(text: Str): Extract<Statement, { kind: "ReturnStmt" }> {
  return {
    kind: "ReturnStmt",
    expression: { kind: "IntegerLiteral", value: BigInt(text), text, span },
    span,
  };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
