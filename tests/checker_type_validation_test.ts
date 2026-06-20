import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeRef } from "core/ast.ts";
import { checkTypeRef } from "checker/type_validation.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts known primitive and alias types", () => {
  const aliases = new Map<Str, TypeRef>([["Pair", record([["x", named("i32")]])]]);

  assertLen(checkTypeRef(named("i32"), aliases).length, 0);
  assertLen(checkTypeRef(named("c_int"), aliases).length, 0);
  assertLen(checkTypeRef(named("Pair"), aliases).length, 0);
});

Deno.test("reports invalid type refs", () => {
  assertText(checkTypeRef(named("Missing"), new Map())[0]?.message ?? "", "Unknown type 'Missing'");
  assertText(
    checkTypeRef(pointer(fixedArray(named("i32"))), new Map())[0]?.message ?? "",
    "Pointer type cannot target array type",
  );
  assertText(
    checkTypeRef(fixedArray(named("i32"), "0"), new Map())[0]?.message ?? "",
    "Array size must be greater than zero",
  );
});

Deno.test("accepts slice type refs", () => {
  const diagnostics = checkTypeRef(slice(named("i32")), new Map());

  assertLen(diagnostics.length, 0);
});

Deno.test("reports invalid record fields", () => {
  const diagnostics = checkTypeRef(
    record([["x", named("void")], ["x", inferredArray(named("i32"))]]),
    new Map(),
  );

  assertText(diagnostics[0]?.message ?? "", "Field 'x' cannot have type 'void'");
  assertText(diagnostics[1]?.message ?? "", "Duplicate field 'x'");
  assertText(diagnostics[2]?.message ?? "", "Field 'x' cannot have inferred array type");
});

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function fixedArray(element: TypeRef, sizeText: Str = "2"): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText, span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function slice(element: TypeRef): TypeRef {
  return { kind: "SliceTypeRef", element, span };
}

function record(fields: [Str, TypeRef][]): TypeRef {
  return {
    kind: "RecordTypeRef",
    fields: fields.map(([name, type]) => ({ name, type, span })),
    span,
  };
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
