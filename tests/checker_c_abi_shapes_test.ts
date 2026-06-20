import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { cParamShape, cTypeShape, indexTypeAliases } from "checker/c_abi_shapes.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("maps references to C pointer ABI shapes", () => {
  assertText(cTypeShape(reference(named("i32")), indexTypeAliases([])), "i32*");
});

Deno.test("maps array params to C pointer ABI shapes", () => {
  assertText(cParamShape(fixedArray(named("i32"), "4"), indexTypeAliases([])), "i32*");
  assertText(cParamShape(inferredArray(named("i32")), indexTypeAliases([])), "i32*");
});

Deno.test("maps named aliases to C names in ABI shapes", () => {
  const aliases = indexTypeAliases([alias("Lib.Color", "Color")]);

  assertText(cTypeShape(named("Lib.Color"), aliases), "Color");
});

function alias(name: Str, cName: Str): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    cName,
    type: { kind: "RecordTypeRef", fields: [], span },
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
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

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
