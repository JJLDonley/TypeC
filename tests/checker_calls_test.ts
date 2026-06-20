import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallArguments } from "checker/calls.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks call arguments", () => {
  const diagnostics = checkCallArguments(
    [integer()],
    fn([param("value", named("i32"))]),
    resolveExpected,
    typeOf,
    span,
  );

  assertLen(diagnostics.length, 0);
});

Deno.test("checks variadic call arguments", () => {
  const variadic = { ...fn([param("format", pointer(named("u8")))]), variadic: true };
  const diagnostics = checkCallArguments(
    [stringLiteral(), integer()],
    variadic,
    resolveExpected,
    typeOf,
    span,
  );

  assertLen(diagnostics.length, 0);
});

Deno.test("reports call arity and type errors", () => {
  const diagnostics = checkCallArguments(
    [integer(), integer()],
    fn([param("value", named("u8"))]),
    resolveActual,
    typeOf,
    span,
  );

  assertText(diagnostics[0]?.message ?? "", "Function 'use' expects 1 arguments, got 2");
  assertText(diagnostics[1]?.message ?? "", "Argument 1 type 'i32' is not assignable to 'u8'");
});

function resolveExpected(_expr: Expression, expected: TypeName): TypeName {
  return expected;
}

function resolveActual(_expr: Expression, _expected: TypeName): TypeName {
  return "i32";
}

function typeOf(_expr: Expression): TypeName {
  return "i32";
}

function fn(params: FunctionDecl["params"]): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name: "use",
    params,
    returnType: named("void"),
    body: null,
    span,
  };
}

function param(name: Str, type: TypeRef): FunctionDecl["params"][usize] {
  return { name, type, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function integer(): Expression {
  return { kind: "IntegerLiteral", value: 1n, text: "1", span };
}

function stringLiteral(): Expression {
  return { kind: "StringLiteral", text: "value", span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
