import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallExpression } from "checker/call_expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks call expression types", () => {
  const result = checkCallExpression(call("add", [integer("1")]), fn("add", ["i32"], "i32"), resolveExpected);

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("reports unknown call expressions", () => {
  const result = checkCallExpression(call("missing", []), undefined, resolveExpected);

  assertText(result.diagnostics[0]?.message ?? "", "Unknown function 'missing'");
  assertText(result.type, "<error>");
});

Deno.test("reports call argument errors", () => {
  const result = checkCallExpression(call("add", []), fn("add", ["i32"], "i32"), resolveExpected);

  assertText(result.diagnostics[0]?.message ?? "", "Function 'add' expects 1 arguments, got 0");
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function call(callee: Str, args: Expression[]): Extract<Expression, { kind: "CallExpr" }> {
  return { kind: "CallExpr", callee, args, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function fn(name: Str, params: TypeName[], returnType: TypeName): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name,
    params: params.map((type, index) => ({ name: `p${index}`, type: named(type), span })),
    returnType: named(returnType),
    body: null,
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
