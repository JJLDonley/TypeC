import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import {
  checkOptionalFieldAccessExpression,
  checkOptionalIndexExpression,
  checkOptionalMethodCallExpression,
} from "checker/optional_chaining.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

const aliases = new Map<Str, TypeRef>([
  ["Point", record([field("x", named("i32"))])],
]);

Deno.test("checks optional field access", () => {
  const result = checkOptionalFieldAccessExpression(
    optionalField(identifier("point"), "x"),
    "Point?",
    aliases,
  );

  assertText(result.type, "i32?");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("checks optional index access", () => {
  const result = checkOptionalIndexExpression(
    optionalIndex(identifier("items"), integer("0")),
    "i32[2]?",
    typeOf,
  );

  assertText(result.type, "i32?");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("checks optional method calls", () => {
  const result = checkOptionalMethodCallExpression(
    optionalMethod(identifier("box"), "get"),
    "Box?",
    method(),
    typeOfExpected,
    typeOf,
  );

  assertText(result.type, "i32?");
  assertLen(result.diagnostics.length, 0);
});

Deno.test("reports non-optional optional chaining operands", () => {
  const result = checkOptionalFieldAccessExpression(
    optionalField(identifier("point"), "x"),
    "Point",
    aliases,
  );

  assertText(result.type, "<error>");
  assertText(
    result.diagnostics[0]?.message ?? "",
    "Optional chaining requires optional operand, got 'Point'",
  );
});

function typeOf(expr: Expression): TypeName {
  if (expr.kind === "IntegerLiteral") return "i32";
  return "<error>";
}

function typeOfExpected(expr: Expression, _expected: TypeName): TypeName {
  return typeOf(expr);
}

function optionalField(
  operand: Expression,
  fieldName: Str,
): Extract<Expression, { kind: "OptionalFieldAccessExpr" }> {
  return { kind: "OptionalFieldAccessExpr", operand, field: fieldName, span };
}

function optionalIndex(
  operand: Expression,
  index: Expression,
): Extract<Expression, { kind: "OptionalIndexExpr" }> {
  return { kind: "OptionalIndexExpr", operand, index, span };
}

function optionalMethod(
  receiver: Expression,
  methodName: Str,
): Extract<Expression, { kind: "OptionalMethodCallExpr" }> {
  return { kind: "OptionalMethodCallExpr", receiver, method: methodName, args: [], span };
}

function identifier(name: Str): Expression {
  return { kind: "IdentifierExpr", name, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function method(): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name: "Box_get",
    params: [{ name: "self", type: named("Box"), span }],
    returnType: named("i32"),
    body: null,
    span,
  };
}

function field(name: Str, type: TypeRef): { name: Str; type: TypeRef; span: SourceSpan } {
  return { name, type, span };
}

function record(fields: { name: Str; type: TypeRef; span: SourceSpan }[]): TypeRef {
  return { kind: "RecordTypeRef", fields, span };
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
