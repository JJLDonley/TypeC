import { checkConstantIntegerDivision } from "checker/constant_division.ts";
import type { ConstDecl, Expression, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type usize = number;

Deno.test("detects referenced integer constant division by zero", () => {
  const diagnostics = checkConstantIntegerDivision(
    binary("/", integer("1"), identifier("ZERO")),
    constants([constant("ZERO", integer("0"))]),
  );

  assertText(diagnostics[0]?.message ?? "", "Operator '/' cannot divide by zero");
});

Deno.test("ignores nonzero integer constant division", () => {
  const diagnostics = checkConstantIntegerDivision(
    binary("/", integer("4"), integer("2")),
    new Map(),
  );

  assertSame(diagnostics.length, 0);
});

Deno.test("ignores mixed numeric constant division", () => {
  const diagnostics = checkConstantIntegerDivision(
    binary("/", float("1.0"), integer("0")),
    new Map(),
  );

  assertSame(diagnostics.length, 0);
});

function constants(values: ConstDecl[]): Map<Str, ConstDecl> {
  return new Map(values.map((value) => [value.name, value]));
}

function constant(name: Str, initializer: Expression): ConstDecl {
  return {
    kind: "ConstDecl",
    exported: false,
    name,
    cName: null,
    type: named("i32"),
    initializer,
    span: sourceSpan(),
  };
}

function binary(operator: Str, left: Expression, right: Expression): Expression {
  return { kind: "BinaryExpr", operator, left, right, span: sourceSpan() };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span: sourceSpan() };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", text, value: BigInt(text), span: sourceSpan() };
}

function float(text: Str): Expression {
  return { kind: "FloatLiteral", text, value: Number(text), span: sourceSpan() };
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

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
