import type { SourceSpan } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import { checkFloatLiteralRange, checkIntegerLiteralRange } from "checker/literal_ranges.ts";

type Str = string;
type f64 = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts literals inside target ranges", () => {
  assertText(checkIntegerLiteralRange(integer("127"), "i8").length.toString(), "0");
  assertText(checkFloatLiteralRange(float("1.0", 1), "f32").length.toString(), "0");
});

Deno.test("reports literals outside target ranges", () => {
  const integerDiagnostics = checkIntegerLiteralRange(integer("128"), "i8");
  const floatDiagnostics = checkFloatLiteralRange(float("1e39", 1e39), "f32");

  assertText(
    integerDiagnostics[0]?.message ?? "",
    "Integer literal '128' is out of range for 'i8'",
  );
  assertText(floatDiagnostics[0]?.message ?? "", "Float literal '1e39' is out of range for 'f32'");
});

function integer(text: Str): Extract<Expression, { kind: "IntegerLiteral" }> {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function float(text: Str, value: f64): Extract<Expression, { kind: "FloatLiteral" }> {
  return { kind: "FloatLiteral", value, text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
