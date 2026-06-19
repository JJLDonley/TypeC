import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkFunctionParamType, checkFunctionReturnType } from "checker/function_signatures.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("reports array function return types", () => {
  const diagnostics = checkFunctionReturnType(fn("items", fixedArray(named("i32"))), "i32[2]");

  assertText(diagnostics[0]?.message ?? "", "Function 'items' cannot return array type 'i32[2]'");
});

Deno.test("reports inferred array parameter types", () => {
  const diagnostics = checkFunctionParamType({ name: "items", type: inferredArray(named("i32")), span }, "sum");

  assertText(diagnostics[0]?.message ?? "", "Parameter 'items' of function 'sum' cannot have inferred array type");
});

Deno.test("accepts valid function signature types", () => {
  assertLen(checkFunctionReturnType(fn("main", named("i32")), "i32").length, 0);
  assertLen(checkFunctionParamType({ name: "value", type: named("i32"), span }, "id").length, 0);
});

function fn(name: Str, returnType: TypeRef): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name,
    params: [],
    returnType,
    body: null,
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function fixedArray(element: TypeRef): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText: "2", span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
