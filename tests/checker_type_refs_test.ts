import type { SourceSpan } from "../src/diagnostics.ts";
import type { TypeRef } from "../src/ast.ts";
import { collectTypeAliasRefs, isArrayTypeRef, isVoidNamedType, isVoidValueType } from "../src/checker_type_refs.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("classifies checker type refs", () => {
  assertSame(isArrayTypeRef(fixedArray(named("i32"))), true);
  assertSame(isArrayTypeRef(inferredArray(named("i32"))), true);
  assertSame(isArrayTypeRef(named("i32")), false);
  assertSame(isVoidNamedType(named("void")), true);
  assertSame(isVoidValueType(fixedArray(named("void"))), true);
});

Deno.test("collects non-primitive type alias refs", () => {
  const record: TypeRef = {
    kind: "RecordTypeRef",
    fields: [
      { name: "a", type: named("A"), span },
      { name: "b", type: fixedArray(pointer(named("B"))), span },
      { name: "c", type: named("i32"), span },
    ],
    span,
  };

  assertText([...collectTypeAliasRefs(record)].join(","), "A,B");
});

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function fixedArray(element: TypeRef): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText: "1", span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
