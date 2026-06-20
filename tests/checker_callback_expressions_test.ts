import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkExpectedCallbackExpression } from "checker/callback_expressions.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts compatible function callback expressions", () => {
  const functions = new Map<Str, FunctionDecl>([["handler", fn("handler", ["i32"], "i32")]]);
  const result = checkExpectedCallbackExpression(
    identifier("handler"),
    "(arg0: i32) => i32",
    functions,
  );

  assertSame(result.handled, true);
  assertText(result.type, "(p0: i32) => i32");
  assertText(result.diagnostics.length.toString(), "0");
});

Deno.test("rejects incompatible function callback expressions", () => {
  const functions = new Map<Str, FunctionDecl>([["handler", fn("handler", ["i64"], "i32")]]);
  const result = checkExpectedCallbackExpression(
    identifier("handler"),
    "(arg0: i32) => i32",
    functions,
  );

  assertSame(result.handled, true);
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Callback 'handler' type '(p0: i64) => i32' is not assignable to '(arg0: i32) => i32'",
  );
});

Deno.test("ignores non-function expected callback expressions", () => {
  const result = checkExpectedCallbackExpression(
    identifier("value"),
    "i32",
    new Map<Str, FunctionDecl>(),
  );

  assertSame(result.handled, false);
});

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function fn(name: Str, params: Str[], returnType: Str): FunctionDecl {
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

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
