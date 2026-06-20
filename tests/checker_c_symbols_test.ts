import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { checkCFunctionSymbols, checkCTypeAliasSymbols } from "checker/c_symbols.ts";

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

Deno.test("compares extern C function symbols by emitted ABI", () => {
  const diagnostics = checkCFunctionSymbols([
    fn("first", null, true, [param("values", fixedArray(named("i32"), "3"))], named("void")),
    fn("Lib.first", "first", true, [param("values", inferredArray(named("i32")))], named("void")),
    fn("use", null, true, [param("value", pointer(named("i32")))], named("void")),
    fn("Lib.use", "use", true, [param("value", reference(named("i32")))], named("void")),
  ]);

  assertSame(diagnostics.length, 0);
});

Deno.test("compares extern C function aliases by emitted C names", () => {
  const aliases = [
    alias("Color", "Color", [["r", named("u8")]]),
    alias("Lib.Color", "Color", [["r", named("u8")]]),
  ];
  const diagnostics = checkCFunctionSymbols([
    fn("draw", null, true, [param("tint", named("Color"))], named("void")),
    fn("Lib.draw", "draw", true, [param("tint", named("Lib.Color"))], named("void")),
  ], aliases);

  assertSame(diagnostics.length, 0);
});

Deno.test("allows duplicate compatible C type aliases", () => {
  const diagnostics = checkCTypeAliasSymbols([
    alias("Color", "Color", [["r", named("u8")]]),
    alias("Lib.Color", "Color", [["r", named("u8")]]),
  ]);

  assertSame(diagnostics.length, 0);
});

Deno.test("rejects duplicate incompatible C type aliases", () => {
  const diagnostics = checkCTypeAliasSymbols([
    alias("Color", "Color", [["r", named("u8")]]),
    alias("Lib.Color", "Color", [["r", named("i32")]]),
  ]);

  assertText(diagnostics[0]?.message ?? "", "Duplicate C type symbol 'Color'");
});

Deno.test("compares nested C type aliases by emitted C names", () => {
  const diagnostics = checkCTypeAliasSymbols([
    alias("Inner", "Inner", [["x", named("i32")]]),
    alias("Outer", "Outer", [["inner", named("Inner")]]),
    alias("Lib.Inner", "Inner", [["x", named("i32")]]),
    alias("Lib.Outer", "Outer", [["inner", named("Lib.Inner")]]),
  ]);

  assertSame(diagnostics.length, 0);
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

function alias(name: Str, cName: Str, fields: [Str, TypeRef][]): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    cName,
    type: {
      kind: "RecordTypeRef",
      fields: fields.map(([fieldName, type]) => ({ name: fieldName, type, span })),
      span,
    },
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function reference(element: TypeRef): TypeRef {
  return { kind: "ReferenceTypeRef", element, span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function fixedArray(element: TypeRef, sizeText: Str): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText, span };
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
