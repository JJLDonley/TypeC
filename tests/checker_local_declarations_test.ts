import type { Expression, Statement, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkLocalDeclaration } from "checker/local_declarations.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks local declarations", () => {
  const result = checkLocalDeclaration(varDecl("value", named("i32"), integer("1")), new Map(), resolveExpected);

  assertLen(result.diagnostics.length, 0);
  assertText(result.type, "i32");
});

Deno.test("stores inferred array local type", () => {
  const result = checkLocalDeclaration(varDecl("items", inferredArray(named("i32")), arrayLiteral([integer("1")])), new Map(), resolveArray);

  assertText(result.type, "i32[1]");
});

Deno.test("reports local declaration errors", () => {
  const result = checkLocalDeclaration(varDecl("value", named("void"), integer("1")), new Map(), resolveActual);

  assertSame(result.diagnostics.some((diagnostic) => diagnostic.message === "Variable 'value' cannot have type 'void'"), true);
  assertSame(result.diagnostics.some((diagnostic) => diagnostic.message === "Initializer type 'i32' is not assignable to 'void'"), true);
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function resolveArray(_expr: Expression, _expected: TypeName): TypeName {
  return "i32[1]";
}

function resolveActual(_expr: Expression, _expected: TypeName): TypeName {
  return "i32";
}

function varDecl(name: Str, type: TypeRef, initializer: Expression): Extract<Statement, { kind: "VarDeclStmt" }> {
  return { kind: "VarDeclStmt", mutable: false, name, type, initializer, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function integer(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
