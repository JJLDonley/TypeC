import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkReturnStatement } from "checker/return_statements.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts valid returns", () => {
  assertLen(checkReturnStatement(null, "void", span, resolveExpected).length, 0);
  assertLen(checkReturnStatement(integer("1"), "i32", span, resolveExpected).length, 0);
});

Deno.test("reports invalid returns", () => {
  assertText(checkReturnStatement(null, "i32", span, resolveExpected)[0]?.message ?? "", "Function must return 'i32'");
  assertText(checkReturnStatement(integer("1"), "void", span, resolveExpected)[0]?.message ?? "", "Void function cannot return a value");
  assertText(checkReturnStatement(integer("1"), "u8", span, resolveActual)[0]?.message ?? "", "Return type 'i32' is not assignable to 'u8'");
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function resolveActual(_expr: Expression, _expected: TypeName): TypeName {
  return "i32";
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
