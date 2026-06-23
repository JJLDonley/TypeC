import {
  evaluateBoolConstant,
  evaluateFloatConstant,
  evaluateIntegerConstant,
} from "checker/constant_values.ts";
import type { ConstDecl, Expression, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type IntValue = bigint;
type f64 = number;
type usize = number;
type b8 = boolean;

Deno.test("evaluates integer constant expressions", () => {
  const constants = constantMap([
    constant("BASE", integer("40")),
    constant("Config.TWO", integer("2")),
  ]);
  const expr = binary("+", identifier("BASE"), field(identifier("Config"), "TWO"));

  assertBigInt(evaluateIntegerConstant(expr, constants) ?? 0n, 42n);
});

Deno.test("evaluates float constant expressions", () => {
  const constants = constantMap([constant("BASE", float("4.0"))]);
  const expr = binary("*", unary("-", identifier("BASE")), float("2.5"));

  assertFloat(evaluateFloatConstant(expr, constants) ?? 0, -10.0);
});

Deno.test("evaluates bool constant expressions", () => {
  const constants = constantMap([constant("FLAG", bool(true))]);
  const expr = binary("&&", identifier("FLAG"), binary("||", bool(false), bool(true)));

  assertBool(evaluateBoolConstant(expr, constants) ?? false, true);
});

Deno.test("returns null for unsupported constant values", () => {
  assertNull(evaluateIntegerConstant(binary("/", integer("1"), integer("0")), new Map()));
  assertNull(evaluateIntegerConstant(float("1.0"), new Map()));
  assertNull(evaluateFloatConstant(stringLiteral("text"), new Map()));
});

function constantMap(constants: ConstDecl[]): Map<Str, ConstDecl> {
  return new Map(constants.map((constant) => [constant.name, constant]));
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

function unary(operator: "+" | "-", operand: Expression): Expression {
  return { kind: "UnaryExpr", operator, operand, span: sourceSpan() };
}

function field(operand: Expression, name: Str): Expression {
  return { kind: "FieldAccessExpr", operand, field: name, span: sourceSpan() };
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

function bool(value: b8): Expression {
  return { kind: "BoolLiteral", value, text: value ? "true" : "false", span: sourceSpan() };
}

function stringLiteral(text: Str): Expression {
  return { kind: "StringLiteral", text, span: sourceSpan() };
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

function assertBigInt(actual: IntValue, expected: IntValue): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertFloat(actual: f64, expected: f64): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertNull(value: unknown): void {
  if (value !== null) throw new Error("Expected null");
}
