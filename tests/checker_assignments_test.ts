import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { checkAssignment } from "checker/assignments.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts mutable assignment", () => {
  const diagnostics = checkAssignment(assignment("value", integer("1")), local("i32", true), resolveExpected);

  assertLen(diagnostics.length, 0);
});

Deno.test("reports invalid assignments", () => {
  const constDiagnostics = checkAssignment(assignment("value", integer("1")), local("i32", false), resolveExpected);
  const arrayDiagnostics = checkAssignment(assignment("items", integer("1")), local("i32[1]", true), resolveExpected);
  const typeDiagnostics = checkAssignment(assignment("value", integer("1")), local("u8", true), resolveActual);

  assertText(constDiagnostics[0]?.message ?? "", "Cannot assign to const 'value'");
  assertText(arrayDiagnostics[0]?.message ?? "", "Cannot assign to array variable 'items'");
  assertText(typeDiagnostics[0]?.message ?? "", "Assignment type 'i32' is not assignable to 'u8'");
});

Deno.test("ignores unresolved assignment locals", () => {
  assertLen(checkAssignment(assignment("missing", integer("1")), undefined, resolveActual).length, 0);
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function resolveActual(_expr: Expression, _expected: TypeName): TypeName {
  return "i32";
}

function local(type: TypeName, mutable: b8): LocalInfo {
  return { type, mutable };
}

function assignment(name: Str, expression: Expression): Extract<Statement, { kind: "AssignmentStmt" }> {
  return { kind: "AssignmentStmt", name, expression, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
