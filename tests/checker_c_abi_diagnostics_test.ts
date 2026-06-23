import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkCAbiFunction } from "checker/c_abi_diagnostics.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts C ABI compatible functions", () => {
  assertLen(
    checkCAbiFunction(
      fn("ok", named("i32"), [{ name: "value", type: named("u8"), span }]),
      "Extern",
      new Map(),
    ).length,
    0,
  );
});

Deno.test("reports non-C ABI function types", () => {
  const diagnostics = checkCAbiFunction(
    fn("bad", reference(named("i32")), [{ name: "items", type: reference(named("i32")), span }]),
    "Exported",
    new Map(),
  );

  assertText(
    diagnostics[0]?.message ?? "",
    "Exported function 'bad' return type 'i32&' is not C ABI compatible",
  );
  assertText(
    diagnostics[1]?.message ?? "",
    "Exported function 'bad' parameter 'items' type 'i32&' is not C ABI compatible",
  );
});

function fn(name: Str, returnType: TypeRef, params: FunctionDecl["params"]): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name,
    params,
    returnType,
    body: null,
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function reference(element: TypeRef): TypeRef {
  return { kind: "ReferenceTypeRef", element, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
