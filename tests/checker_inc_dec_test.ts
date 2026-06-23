import type { Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { checkIncDec } from "checker/inc_dec.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts mutable integer increment and decrement", () => {
  assertLen(checkIncDec(incDec("value", "++"), local("i32", true)).length, 0);
  assertLen(checkIncDec(incDec("value", "--"), local("usize", true)).length, 0);
});

Deno.test("reports invalid increment and decrement targets", () => {
  const constDiagnostics = checkIncDec(incDec("value", "++"), local("i32", false));
  const arrayDiagnostics = checkIncDec(incDec("items", "++"), local("i32[1]", true));
  const typeDiagnostics = checkIncDec(incDec("value", "--"), local("f32", true));

  assertText(constDiagnostics[0]?.message ?? "", "Cannot assign to const 'value'");
  assertText(arrayDiagnostics[0]?.message ?? "", "Cannot assign to array variable 'items'");
  assertText(typeDiagnostics[0]?.message ?? "", "Operator '--' requires an integer target");
});

Deno.test("ignores unresolved increment and decrement locals", () => {
  assertLen(checkIncDec(incDec("missing", "++"), undefined).length, 0);
});

function incDec(
  name: Str,
  operator: Extract<Statement, { kind: "IncDecStmt" }>["operator"],
): Extract<Statement, { kind: "IncDecStmt" }> {
  return { kind: "IncDecStmt", name, operator, span };
}

function local(type: TypeName, mutable: b8): LocalInfo {
  return { type, mutable };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
