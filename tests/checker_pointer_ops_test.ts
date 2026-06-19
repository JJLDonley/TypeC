import type { SourceSpan } from "../src/diagnostics.ts";
import type { Expression } from "../src/ast.ts";
import { checkPostfixPointerOperation } from "../src/checker_pointer_ops.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks postfix address operations", () => {
  const ok = checkPostfixPointerOperation(pointer(".&", identifier("x")), "i32");
  const bad = checkPostfixPointerOperation(pointer(".&", integer("1")), "i32");

  assertText(ok.type, "i32&");
  assertLen(ok.diagnostics.length, 0);
  assertText(bad.diagnostics[0]?.message ?? "", "Cannot take address of non-addressable expression");
});

Deno.test("checks postfix dereference operations", () => {
  const pointerResult = checkPostfixPointerOperation(pointer(".*", identifier("p")), "i32*");
  const referenceResult = checkPostfixPointerOperation(pointer(".*", identifier("r")), "i32&");
  const bad = checkPostfixPointerOperation(pointer(".*", identifier("x")), "i32");

  assertText(pointerResult.type, "i32");
  assertText(referenceResult.type, "i32");
  assertText(bad.type, "<error>");
  assertText(bad.diagnostics[0]?.message ?? "", "Cannot dereference non-pointer-like type 'i32'");
});

function pointer(operator: ".*" | ".&", operand: Expression): Extract<Expression, { kind: "PostfixPointerExpr" }> {
  return { kind: "PostfixPointerExpr", operator, operand, span };
}

function identifier(name: Str): Extract<Expression, { kind: "IdentifierExpr" }> {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Extract<Expression, { kind: "IntegerLiteral" }> {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
