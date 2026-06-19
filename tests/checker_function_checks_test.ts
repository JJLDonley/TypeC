import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkFunctionHeader } from "checker/function_checks.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks valid function headers", () => {
  const result = checkFunctionHeader(fn("add", false, false, [], "i32"), "i32", aliases());

  assertLen(result.length, 0);
});

Deno.test("reports invalid function headers", () => {
  const invalidMain = checkFunctionHeader(fn("main", false, false, [param("argc", "i32")], "i32"), "i32", aliases());
  const invalidReturn = checkFunctionHeader(fn("items", false, false, [], "i32[]"), "i32[]", aliases());

  assertText(invalidMain[0]?.message ?? "", "Function 'main' cannot have parameters");
  assertText(invalidReturn[0]?.message ?? "", "Function 'items' cannot return array type 'i32[]'");
});

function aliases(): Map<Str, TypeRef> {
  return new Map<Str, TypeRef>();
}

function fn(name: Str, exported: b8, external: b8, params: FunctionDecl["params"], returnType: Str): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported,
    external,
    name,
    params,
    returnType: named(returnType),
    body: external ? null : { kind: "BlockStmt", statements: [], span },
    span,
  };
}

function param(name: Str, type: Str): FunctionDecl["params"][usize] {
  return { name, type: named(type), span };
}

function named(name: Str): TypeRef {
  if (name.endsWith("[]")) return { kind: "InferredArrayTypeRef", element: named(name.slice(0, -2)), span };
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
