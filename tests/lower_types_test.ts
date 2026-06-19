import type { SourceSpan } from "core/diagnostics.ts";
import type { CastTypeRef } from "core/cast.ts";
import { lowerTypeRef } from "lower/types.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("lowers nested type refs", () => {
  const type: CastTypeRef = {
    kind: "FixedArrayTypeRef",
    element: {
      kind: "ReferenceTypeRef",
      element: {
        kind: "PointerTypeRef",
        element: named("i32"),
        span,
      },
      span,
    },
    sizeText: "4",
    span,
  };

  assertText(lowerTypeRef(type).kind, "FixedArrayTypeRef");
});

Deno.test("lowers record type refs", () => {
  const type: CastTypeRef = {
    kind: "RecordTypeRef",
    fields: [
      { name: "values", type: { kind: "InferredArrayTypeRef", element: named("u8"), span }, span },
    ],
    span,
  };

  assertText(lowerTypeRef(type).kind, "RecordTypeRef");
});

function named(name: Str): CastTypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
