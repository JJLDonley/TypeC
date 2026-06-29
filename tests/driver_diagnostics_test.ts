import { type SourceSpan, TypeCError } from "core/diagnostics.ts";
import { formatTypeCDiagnostics } from "driver/diagnostics.ts";

type Str = string;

type usize = number;

Deno.test("formats driver TypeC diagnostics", () => {
  const source = "function main( {";
  const text = formatTypeCDiagnostics(
    "bad.tc",
    source,
    new TypeCError([{ message: "Expected ')'", span: span(1, 15) }]),
  );
  assertText(
    text,
    "error: Expected ')'\n --> bad.tc:1:15\n  |\n1 | function main( {\n  |               ^",
  );
});

Deno.test("formats related diagnostic spans", () => {
  const source = "readonly x: i32;\nx = 1;";
  const text = formatTypeCDiagnostics(
    "bad.tc",
    source,
    new TypeCError([{
      message: "Field 'x' is readonly",
      code: "E0182",
      span: span(2, 1),
      related: [{ message: "readonly field 'x' declared here", span: span(1, 10) }],
    }]),
  );

  if (!text.includes("error[E0182]: Field 'x' is readonly")) {
    throw new Error(`Expected diagnostic code, got ${text}`);
  }
  if (!text.includes("note: readonly field 'x' declared here")) {
    throw new Error(`Expected related note, got ${text}`);
  }
});

function span(line: usize, column: usize): SourceSpan {
  const offset = column - 1;
  return {
    start: { offset, line, column },
    end: { offset, line, column },
  };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
