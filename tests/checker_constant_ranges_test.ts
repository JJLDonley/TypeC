import { checkConstantRanges } from "checker/constant_ranges.ts";
import type { Expression, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type usize = number;

Deno.test("checks integer constant expression ranges", () => {
  const diagnostics = checkConstantRanges(
    binary("+", integer("255"), integer("1")),
    "u8",
    new Map(),
    new Map(),
  );

  assertText(diagnostics[0]?.message ?? "", "Integer constant '256' is out of range for 'u8'");
});

Deno.test("checks float constant expression ranges", () => {
  const diagnostics = checkConstantRanges(
    binary("*", float("340000000000000000000000000000000000000.0"), float("10.0")),
    "f32",
    new Map(),
    new Map(),
  );

  assertText(diagnostics[0]?.message ?? "", "Float constant '3.4e+39' is out of range for 'f32'");
});

Deno.test("checks aggregate constant expression ranges", () => {
  const arrayDiagnostics = checkConstantRanges(
    array([binary("+", integer("255"), integer("1"))]),
    "u8[1]",
    new Map(),
    new Map(),
  );
  const recordDiagnostics = checkConstantRanges(
    record([["r", binary("+", integer("255"), integer("1"))]]),
    "Pixel",
    new Map(),
    aliases([["Pixel", recordType([["r", named("u8")]])]]),
  );

  assertText(arrayDiagnostics[0]?.message ?? "", "Integer constant '256' is out of range for 'u8'");
  assertText(
    recordDiagnostics[0]?.message ?? "",
    "Integer constant '256' is out of range for 'u8'",
  );
});

function aliases(entries: [Str, TypeRef][]): Map<Str, TypeRef> {
  return new Map(entries);
}

function binary(operator: Str, left: Expression, right: Expression): Expression {
  return { kind: "BinaryExpr", operator, left, right, span: sourceSpan() };
}

function array(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span: sourceSpan() };
}

function record(fields: [Str, Expression][]): Expression {
  return {
    kind: "RecordLiteralExpr",
    fields: fields.map(([name, expression]) => ({ name, expression, span: sourceSpan() })),
    span: sourceSpan(),
  };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", text, value: BigInt(text), span: sourceSpan() };
}

function float(text: Str): Expression {
  return { kind: "FloatLiteral", text, value: Number(text), span: sourceSpan() };
}

function recordType(fields: [Str, TypeRef][]): TypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span: sourceSpan() })),
    span: sourceSpan(),
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span: sourceSpan() };
}

function sourceSpan(): SourceSpan {
  return { start: sourcePos(0), end: sourcePos(1) };
}

function sourcePos(offset: usize): SourceSpan["start"] {
  return { offset, line: 1, column: offset + 1 };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
