import type { Expression, FunctionDecl, TypeAliasDecl } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitAssignment, type LocalTypes } from "emitter/assignments.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits assignments with known local types", () => {
  assertText(
    emitAssignment(assignment("x", int("7")), context(), locals([["x", "i32"]])),
    "x = 7;",
  );
});

Deno.test("emits assignments without known local types", () => {
  assertText(emitAssignment(assignment("x", int("7")), context(), locals()), "x = 7;");
});

function assignment(name: Str, expression: Expression) {
  return { kind: "AssignmentStmt" as const, name, expression, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function locals(entries: [Str, Str][] = []): LocalTypes {
  return new Map<Str, Str>(entries);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
