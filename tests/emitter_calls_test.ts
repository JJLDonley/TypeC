import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { createEmitContext, type EmitContext } from "emitter/context.ts";
import { emitCallExpression } from "emitter/calls.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits array literal call arguments", () => {
  const output = emitCallExpression(call("sum", [arrayLiteral([integer("1"), integer("2")])]), context([arrayParam("items", "i32", "2")]), emitExpression, emitExpressionExpected, emitArrayLiteral);

  assertText(output, "sum((i32[2]){ 1, 2 })");
});

Deno.test("emits string literal fixed array call arguments", () => {
  const output = emitCallExpression(call("consume", [stringLiteral("hello")]), context([arrayParam("data", "u8", "6")]), emitExpression, emitExpressionExpected, emitArrayLiteral);

  assertText(output, "consume((u8*)\"hello\")");
});

function emitArrayLiteral(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, ctx: EmitContext, expectedType: Str | null): Str {
  const elements = expr.elements.map((element) => emitExpressionExpected(element, expectedType ?? "i32", ctx));
  return `{ ${elements.join(", ")} }`;
}

function context(params: FunctionDecl["params"]): EmitContext {
  return createEmitContext({
    kind: "Program",
    imports: [],
    typeAliases: [],
    functions: [{ kind: "FunctionDecl", exported: false, external: true, name: "sum", params, returnType: named("i32"), body: null, span }, { kind: "FunctionDecl", exported: false, external: true, name: "consume", params, returnType: named("void"), body: null, span }],
    span,
    symbols: [],
    scopes: [],
    expressionTypes: new Map(),
  });
}

function arrayParam(name: Str, element: Str, sizeText: Str): FunctionDecl["params"][usize] {
  return { name, type: { kind: "FixedArrayTypeRef", element: named(element), sizeText, span }, span };
}

function call(callee: Str, args: Expression[]): Extract<Expression, { kind: "CallExpr" }> {
  return { kind: "CallExpr", callee, args, span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function stringLiteral(text: Str): Expression {
  return { kind: "StringLiteral", text, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
