import type { Expression } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkNullishCoalesceExpression } from "checker/nullish_coalescing.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks nullish coalescing expressions", () => {
  const result = checkNullishCoalesceExpression(
    nullish(identifier("value"), integer("1")),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "i32");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports non-optional nullish left operands", () => {
  const result = checkNullishCoalesceExpression(
    nullish(identifier("plain"), integer("1")),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "<error>");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Nullish coalescing requires optional left operand, got 'i32'",
  );
});

Deno.test("reports incompatible nullish fallbacks", () => {
  const result = checkNullishCoalesceExpression(
    nullish(identifier("value"), identifier("flag")),
    typeOf,
    typeOfExpected,
  );

  assertText(result.type, "<error>");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Nullish coalescing fallback type 'bool' is not assignable to 'i32'",
  );
});

function typeOf(expr: Expression): TypeName {
  if (expr.kind === "IdentifierExpr" && expr.name === "value") return "i32?";
  if (expr.kind === "IdentifierExpr" && expr.name === "plain") return "i32";
  if (expr.kind === "IdentifierExpr" && expr.name === "flag") return "bool";
  if (expr.kind === "IntegerLiteral") return "i32";
  return "<error>";
}

function typeOfExpected(expr: Expression, _expected: TypeName): TypeName {
  return typeOf(expr);
}

function nullish(
  left: Expression,
  fallback: Expression,
): Extract<Expression, { kind: "NullishCoalesceExpr" }> {
  return { kind: "NullishCoalesceExpr", operator: "??", left, fallback, span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
