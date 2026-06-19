import type { SourceSpan } from "../src/diagnostics.ts";
import {
  checkCallArgumentType,
  checkCallArity,
} from "../src/checker_call_args.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts valid call arguments", () => {
  assertLen(checkCallArity(2, 2, "add", span).length, 0);
  assertLen(checkCallArgumentType("i32", "i32", 0, span).length, 0);
});

Deno.test("reports invalid call arguments", () => {
  const arityDiagnostics = checkCallArity(1, 2, "add", span);
  const typeDiagnostics = checkCallArgumentType("f64", "i32", 1, span);

  assertText(arityDiagnostics[0]?.message ?? "", "Function 'add' expects 2 arguments, got 1");
  assertText(typeDiagnostics[0]?.message ?? "", "Argument 2 type 'f64' is not assignable to 'i32'");
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
