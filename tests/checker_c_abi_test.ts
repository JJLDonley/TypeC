import type { SourceSpan } from "../src/diagnostics.ts";
import type { TypeRef } from "../src/ast.ts";
import { isCAbiType } from "checker/c_abi.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("classifies primitive and pointer C ABI types", () => {
  const aliases = new Map<Str, TypeRef>();

  assertSame(isCAbiType(named("i32"), aliases), true);
  assertSame(isCAbiType(pointer(named("void")), aliases), true);
  assertSame(isCAbiType(reference(named("i32")), aliases), false);
  assertSame(isCAbiType(inferredArray(named("i32")), aliases), false);
});

Deno.test("classifies record alias C ABI types", () => {
  const aliases = new Map<Str, TypeRef>([
    ["Pair", record([["x", named("i32")], ["items", fixedArray(named("u8"))]])],
    ["Bad", record([["x", reference(named("i32"))]])],
  ]);

  assertSame(isCAbiType(named("Pair"), aliases), true);
  assertSame(isCAbiType(named("Bad"), aliases), false);
  assertSame(isCAbiType(record([["inner", named("Pair")]]), aliases), true);
});

Deno.test("rejects recursive C ABI aliases", () => {
  const aliases = new Map<Str, TypeRef>([
    ["Node", record([["next", named("Node")]])],
  ]);

  assertSame(isCAbiType(named("Node"), aliases), false);
});

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

function fixedArray(element: TypeRef): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText: "2", span };
}

function record(fields: [Str, TypeRef][]): TypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span })),
    span,
  };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
