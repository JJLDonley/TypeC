import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkCFunctionSymbols } from "checker/c_symbols.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("allows duplicate compatible extern C symbols", () => {
  const diagnostics = checkCFunctionSymbols([
    fn("tick", null, true, [], named("void")),
    fn("Lib.tick", "tick", true, [], named("void")),
  ]);

  assertSame(diagnostics.length, 0);
});

Deno.test("rejects duplicate non-extern C symbols", () => {
  const diagnostics = checkCFunctionSymbols([
    fn("Math.add", "Math_add", false, [param("a", named("i32"))], named("i32")),
    fn("Math_add", null, false, [param("a", named("i32"))], named("i32")),
  ]);

  assertText(diagnostics[0]?.message ?? "", "Duplicate C function symbol 'Math_add'");
});

Deno.test("rejects duplicate incompatible extern C symbols", () => {
  const diagnostics = checkCFunctionSymbols([
    fn("tick", null, true, [], named("void")),
    fn("Lib.tick", "tick", true, [param("value", named("i32"))], named("void")),
  ]);

  assertText(diagnostics[0]?.message ?? "", "Duplicate C function symbol 'tick'");
});

function fn(
  name: Str,
  cName: Str | null,
  external: b8,
  params: FunctionDecl["params"],
  returnType: TypeRef,
): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external,
    name,
    cName,
    params,
    returnType,
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

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
