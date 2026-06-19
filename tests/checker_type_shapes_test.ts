import type { TypeRef } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import {
  checkArrayElementType,
  checkArraySize,
  checkPointerElementType,
  checkReferenceElementType,
} from "../src/checker_type_shapes.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("checks pointer element shapes", () => {
  assertLen(checkPointerElementType({ kind: "PointerTypeRef", element: named("i32"), span }).length, 0);
  assertText(checkPointerElementType({ kind: "PointerTypeRef", element: array(named("i32")), span })[0]?.message ?? "", "Pointer type cannot target array type");
});

Deno.test("checks reference element shapes", () => {
  assertText(checkReferenceElementType({ kind: "ReferenceTypeRef", element: named("void"), span })[0]?.message ?? "", "Reference type cannot target void type");
  assertText(checkReferenceElementType({ kind: "ReferenceTypeRef", element: array(named("i32")), span })[0]?.message ?? "", "Reference type cannot target array type");
});

Deno.test("checks array element shapes and sizes", () => {
  assertText(checkArrayElementType(array(array(named("i32"))))[0]?.message ?? "", "Array type cannot target array type");
  assertLen(checkArraySize("1", fixedArray(named("i32"), "1")).length, 0);
  assertText(checkArraySize("0", fixedArray(named("i32"), "0"))[0]?.message ?? "", "Array size must be greater than zero");
});

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function array(element: TypeRef): Extract<TypeRef, { kind: "InferredArrayTypeRef" }> {
  return { kind: "InferredArrayTypeRef", element, span };
}

function fixedArray(element: TypeRef, sizeText: Str): Extract<TypeRef, { kind: "FixedArrayTypeRef" }> {
  return { kind: "FixedArrayTypeRef", element, sizeText, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
