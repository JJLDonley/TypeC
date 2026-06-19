import type { SourceSpan } from "core/diagnostics.ts";
import {
  checkIfCondition,
  checkWhileCondition,
} from "checker/conditions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts bool control conditions", () => {
  assertLen(checkIfCondition("bool", span).length, 0);
  assertLen(checkWhileCondition("bool", span).length, 0);
});

Deno.test("reports non-bool control conditions", () => {
  const ifDiagnostics = checkIfCondition("i32", span);
  const whileDiagnostics = checkWhileCondition("f64", span);

  assertText(ifDiagnostics[0]?.message ?? "", "If condition type 'i32' is not assignable to 'bool'");
  assertText(whileDiagnostics[0]?.message ?? "", "While condition type 'f64' is not assignable to 'bool'");
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
