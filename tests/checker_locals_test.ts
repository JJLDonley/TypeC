import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { createFunctionLocals } from "checker/locals.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("creates immutable function parameter locals", () => {
  const locals = createFunctionLocals(functionDecl());

  assertText(locals.get("count")?.type ?? "", "i32");
  assertText(locals.get("items")?.type ?? "", "u8[4]");
  assertBool(locals.get("count")?.mutable ?? true, false);
});

function functionDecl(): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name: "sum",
    params: [
      { name: "count", type: named("i32"), span },
      {
        name: "items",
        type: { kind: "FixedArrayTypeRef", element: named("u8"), sizeText: "4", span },
        span,
      },
    ],
    returnType: named("i32"),
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

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
