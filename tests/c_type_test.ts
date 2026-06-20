import type { TypeRef } from "core/ast.ts";
import { emitCDeclarator, emitCParamDeclarator, emitCType } from "c/type.ts";

type Str = string;

Deno.test("maps primitive TypeC names one-to-one", () => {
  assertEquals(emitCType(namedType("i32")), "i32");
  assertEquals(emitCType(namedType("usize")), "usize");
  assertEquals(emitCType(namedType("bool")), "b8");
  assertEquals(emitCType(namedType("c_int")), "c_int");
});

Deno.test("maps pointer and reference types to C pointers", () => {
  assertEquals(
    emitCType({ kind: "PointerTypeRef", element: namedType("i32"), span: fakeSpan() }),
    "i32*",
  );
  assertEquals(
    emitCType({ kind: "ReferenceTypeRef", element: namedType("i32"), span: fakeSpan() }),
    "i32*",
  );
});

Deno.test("emits fixed array declarators", () => {
  const type = fixedArray(namedType("i32"), "3");
  assertEquals(emitCDeclarator(type, "values"), "i32 values[3]");
});

Deno.test("emits nested fixed array declarators", () => {
  const type = fixedArray(fixedArray(namedType("i32"), "3"), "2");
  assertEquals(emitCDeclarator(type, "values"), "i32 values[2][3]");
});

Deno.test("emits array parameter declarators as pointers", () => {
  const inferred: TypeRef = {
    kind: "InferredArrayTypeRef",
    element: namedType("i32"),
    span: fakeSpan(),
  };
  const fixed = fixedArray(namedType("i32"), "3");
  const nested = fixedArray(fixedArray(namedType("i32"), "3"), "2");
  const inferredNested: TypeRef = {
    kind: "InferredArrayTypeRef",
    element: fixed,
    span: fakeSpan(),
  };
  assertEquals(emitCParamDeclarator(inferred, "values"), "i32* values");
  assertEquals(emitCParamDeclarator(fixed, "values"), "i32* values");
  assertEquals(emitCParamDeclarator(nested, "values"), "i32 (*values)[3]");
  assertEquals(emitCParamDeclarator(inferredNested, "values"), "i32 (*values)[3]");
});

function fixedArray(element: TypeRef, sizeText: Str): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText, span: fakeSpan() };
}

function namedType(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span: fakeSpan() };
}

function fakeSpan(): TypeRef["span"] {
  const pos = { offset: 0, line: 1, column: 1 };
  return { start: pos, end: pos };
}

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
