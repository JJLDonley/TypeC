import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitFunctionPrototype, emitFunctionSignature } from "emitter/functions.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits function signatures", () => {
  assertText(
    emitFunctionSignature(
      fn(
        "add",
        false,
        false,
        [param("a", named("i32")), param("b", pointer(named("u8")))],
        named("i32"),
      ),
      context(),
    ),
    "static i32 add(i32 a, u8* b)",
  );
  assertText(
    emitFunctionSignature(fn("main", false, false, [], named("i32")), context()),
    "i32 main(void)",
  );
  assertText(
    emitFunctionSignature(fn("api", true, false, [], named("void")), context()),
    "void api(void)",
  );
  assertText(
    emitFunctionSignature(fn("puts", false, true, [], named("i32")), context()),
    "i32 puts(void)",
  );
});

Deno.test("emits function prototypes", () => {
  assertText(
    emitFunctionPrototype(fn("main", false, false, [], named("i32")), context()),
    "i32 main(void);",
  );
});

function fn(
  name: Str,
  exported: b8,
  external: b8,
  params: FunctionDecl["params"],
  returnType: TypeRef,
): FunctionDecl {
  return { kind: "FunctionDecl", exported, external, name, params, returnType, body: null, span };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function param(name: Str, type: TypeRef): FunctionDecl["params"][0] {
  return { name, type, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
