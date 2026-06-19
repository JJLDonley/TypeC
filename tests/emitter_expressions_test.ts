import type { Expression, FunctionDecl, TypeAliasDecl, TypeRef } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { createEmitContext, type EmitContext } from "../src/emitter_context.ts";
import { emitExpression, emitExpressionExpected } from "../src/emitter_expressions.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits nested expression operands", () => {
  assertText(emitExpression(binary(int("1"), "*", binary(int("2"), "+", int("3"))), context()), "1 * (2 + 3)");
});

Deno.test("emits expected record and array expressions", () => {
  const ctx = context([recordAlias("Pair")]);

  assertText(
    emitExpressionExpected(recordLiteral("x", int("7")), "Pair", ctx),
    "(Pair){ .x = 7 }",
  );
  assertText(
    emitExpressionExpected(arrayLiteral([int("1"), int("2")]), "i32[2]", ctx),
    "{ 1, 2 }",
  );
});

Deno.test("emits call array compound literals", () => {
  const ctx = context([], [fnWithArrayParam()]);

  assertText(emitExpression({ kind: "CallExpr", callee: "sum", args: [arrayLiteral([int("1"), int("2")])], span }, ctx), "sum((i32[2]){ 1, 2 })");
});

function context(typeAliases: TypeAliasDecl[] = [], functions: FunctionDecl[] = []): EmitContext {
  return createEmitContext({
    kind: "Program",
    imports: [],
    typeAliases,
    functions,
    span,
    symbols: [],
    scopes: [],
    expressionTypes: new Map(),
  });
}

function recordAlias(name: Str): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    type: { kind: "RecordTypeRef", fields: [{ name: "x", type: named("i32"), span }], span },
    span,
  };
}

function fnWithArrayParam(): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name: "sum",
    params: [{ name: "items", type: { kind: "FixedArrayTypeRef", element: named("i32"), sizeText: "2", span }, span }],
    returnType: named("i32"),
    body: null,
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function binary(left: Expression, operator: Str, right: Expression): Expression {
  return { kind: "BinaryExpr", left, operator, right, span };
}

function recordLiteral(name: Str, expression: Expression): Expression {
  return { kind: "RecordLiteralExpr", fields: [{ name, expression, span }], span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
