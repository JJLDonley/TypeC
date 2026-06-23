import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkConditionalExpression } from "checker/conditional_expressions.ts";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("checks conditional expressions", () => {
  const result = checkConditionalExpression(
    conditional(identifier("flag"), integer("1"), integer("2")),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports non-bool conditional conditions", () => {
  const result = checkConditionalExpression(
    conditional(integer("0"), integer("1"), integer("2")),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "i32");
  assertText(result.diagnostics[0]?.message ?? "", "Conditional expression condition must be bool");
});

Deno.test("reports incompatible conditional branches", () => {
  const result = checkConditionalExpression(
    conditional(identifier("flag"), integer("1"), boolLiteral(false)),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "<error>");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Conditional branches have incompatible types 'i32' and 'bool'",
  );
});

function typeOf(expr: Expression): TypeName {
  if (expr.kind === "BoolLiteral") return "bool";
  if (expr.kind === "IdentifierExpr" && expr.name === "flag") return "bool";
  if (expr.kind === "IntegerLiteral") return "i32";
  return "<error>";
}

function typeOfExpected(expr: Expression, expected: TypeName): TypeName {
  if (expr.kind === "IntegerLiteral" && expected === "i64") return "i64";
  return typeOf(expr);
}

function conditional(
  condition: Expression,
  whenTrue: Expression,
  whenFalse: Expression,
): Extract<Expression, { kind: "ConditionalExpr" }> {
  return { kind: "ConditionalExpr", condition, whenTrue, whenFalse, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function boolLiteral(value: b8): Expression {
  return { kind: "BoolLiteral", value, text: value ? "true" : "false", span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
