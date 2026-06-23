import type { Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitIncDec } from "emitter/inc_dec.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits increment and decrement statements", () => {
  assertText(emitIncDec(incDec("x", "++")), "x++;");
  assertText(emitIncDec(incDec("y", "--")), "y--;");
});

function incDec(
  name: Str,
  operator: Extract<Statement, { kind: "IncDecStmt" }>["operator"],
): Extract<Statement, { kind: "IncDecStmt" }> {
  return { kind: "IncDecStmt", name, operator, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
