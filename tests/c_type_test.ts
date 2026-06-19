import type { TypeRef } from "core/ast.ts";
import { emitCDeclarator, emitCType } from "c/type.ts";

type Str = string;

Deno.test("maps primitive TypeC names one-to-one", () => {
  assertEquals(emitCType(namedType("i32")), "i32");
  assertEquals(emitCType(namedType("usize")), "usize");
  assertEquals(emitCType(namedType("bool")), "b8");
});

Deno.test("maps pointer and reference types to C pointers", () => {
  assertEquals(emitCType({ kind: "PointerTypeRef", element: namedType("i32"), span: fakeSpan() }), "i32*");
  assertEquals(emitCType({ kind: "ReferenceTypeRef", element: namedType("i32"), span: fakeSpan() }), "i32*");
});

Deno.test("emits fixed array declarators", () => {
  const type: TypeRef = { kind: "FixedArrayTypeRef", element: namedType("i32"), sizeText: "3", span: fakeSpan() };
  assertEquals(emitCDeclarator(type, "values"), "i32 values[3]");
});

Deno.test("emits inferred array parameters as pointers", () => {
  const type: TypeRef = { kind: "InferredArrayTypeRef", element: namedType("i32"), span: fakeSpan() };
  assertEquals(emitCDeclarator(type, "values"), "i32* values");
});

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
