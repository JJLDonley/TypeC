import { constModifierDiagnostics, parse, parseCast, span } from "parser";
import { lex } from "core/lexer.ts";
import type { SourcePos } from "core/diagnostics.ts";

type Str = string;
type usize = number;

Deno.test("exports parser public helpers", () => {
  assertText(typeof parse, "function");
  assertText(typeof parseCast, "function");
  assertText(typeof constModifierDiagnostics, "function");
  const start = sourcePos(1);
  const end = sourcePos(2);
  assertText(`${span(start, end).start.offset}:${span(start, end).end.offset}`, "1:2");
});

Deno.test("exports parser entrypoints", () => {
  const program = parse(lex("function main(): i32 { return 0; }"));
  assertText(program.functions[0].name, "main");
});

function sourcePos(offset: usize): SourcePos {
  return { offset, line: 1, column: offset + 1 };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
