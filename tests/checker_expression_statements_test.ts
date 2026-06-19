import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkExpressionStatement } from "checker/expression_statements.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts call expression statements", () => {
  assertLen(checkExpressionStatement(call()).length, 0);
});

Deno.test("reports non-call expression statements", () => {
  const diagnostics = checkExpressionStatement(integer("1"));

  assertText(diagnostics[0]?.message ?? "", "Expression statements must be function calls");
});

function call(): Expression {
  return { kind: "CallExpr", callee: "tick", args: [], span };
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
