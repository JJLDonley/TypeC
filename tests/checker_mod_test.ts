import {
  check,
  checkArrayIndex,
  checkConstantIntegerDivision,
  checkConstantRanges,
  checkSwitchStatement,
  evaluateBoolConstant,
  evaluateIntegerConstant,
  isAssignable,
  parseArrayTypeName,
} from "checker";
import type { Expression, Statement } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { resolve } from "core/resolver.ts";

type Str = string;
type usize = number;

Deno.test("exports checker public helpers", () => {
  assertText(typeof check, "function");
  assertText(`${isAssignable("i32", "i32")}`, "true");
  assertText(`${checkArrayIndex(integerLiteral(), "i32", null).length}`, "0");
  assertText(`${checkConstantIntegerDivision(integerLiteral(), new Map()).length}`, "0");
  assertText(`${checkConstantRanges(integerLiteral(), "i32", new Map(), new Map()).length}`, "0");
  assertText(
    `${checkSwitchStatement(switchStmt(), new Map(), () => "i32", () => "i32", () => []).length}`,
    "0",
  );
  assertText(`${evaluateBoolConstant(boolLiteral(), new Map())}`, "true");
  assertText(`${evaluateIntegerConstant(integerLiteral(), new Map()) ?? 0n}`, "0");
  assertText(parseArrayTypeName("i32[2]")?.element ?? "", "i32");
});

Deno.test("exports checker entrypoint", () => {
  const program = check(resolve(parse(lex("function main(): i32 { return 0; }"))));
  assertText(program.functions[0].name, "main");
});

function switchStmt(): Extract<Statement, { kind: "SwitchStmt" }> {
  return {
    kind: "SwitchStmt",
    expression: integerLiteral(),
    cases: [{ labels: [integerLiteral()], statements: [], span: sourceSpan() }],
    defaultCase: null,
    span: sourceSpan(),
  };
}

function integerLiteral(): Expression {
  return { kind: "IntegerLiteral", text: "0", value: 0n, span: sourceSpan() };
}

function boolLiteral(): Expression {
  return { kind: "BoolLiteral", text: "true", value: true, span: sourceSpan() };
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
