import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { childLocalTypes, type LocalTypes, registerLocalType } from "emitter/local_types.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("copies child local types", () => {
  const parent = locals([["x", "i32"]]);
  const child = childLocalTypes(parent);
  child.set("y", "i32");

  assertText(parent.get("y") ?? "", "");
  assertText(child.get("x") ?? "", "i32");
});

Deno.test("registers local C type names", () => {
  const current = locals();
  registerLocalType(current, "x", named("i32"), new Map<Str, TypeAliasDecl>());

  assertText(current.get("x") ?? "", "i32");
});

function locals(entries: [Str, Str][] = []): LocalTypes {
  return new Map<Str, Str>(entries);
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
