import type { TypeRef } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { checkValueType } from "checker/value_types.ts";

type Str = string;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts non-void value types", () => {
  assertLen(checkValueType(named("i32"), "bad", span).length, 0);
  assertLen(checkValueType(pointer(named("void")), "bad", span).length, 0);
});

Deno.test("reports void value types", () => {
  const diagnostics = checkValueType(named("void"), "Value cannot have type 'void'", span);

  assertText(diagnostics[0]?.message ?? "", "Value cannot have type 'void'");
});

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function pointer(element: TypeRef): TypeRef {
  return { kind: "PointerTypeRef", element, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
