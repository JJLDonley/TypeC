import type { SourceSpan } from "core/diagnostics.ts";
import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { emitTypeAlias } from "emitter/type_aliases.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits record type aliases", () => {
  const alias: TypeAliasDecl = {
    kind: "TypeAliasDecl",
    exported: false,
    name: "Pair",
    type: {
      kind: "RecordTypeRef",
      fields: [
        { name: "x", type: named("i32"), span },
        {
          name: "items",
          type: { kind: "FixedArrayTypeRef", element: named("u8"), sizeText: "4", span },
          span,
        },
      ],
      span,
    },
    span,
  };

  assertText(
    emitTypeAlias(alias, context()),
    "typedef struct {\n  i32 x;\n  u8 items[4];\n} Pair;",
  );
});

Deno.test("emits record aliases with C names", () => {
  const alias: TypeAliasDecl = {
    kind: "TypeAliasDecl",
    exported: false,
    name: "RL.Color",
    cName: "Color",
    type: { kind: "RecordTypeRef", fields: [], span },
    span,
  };

  assertText(emitTypeAlias(alias, context([["RL.Color", alias]])), "typedef struct {\n} Color;");
});

Deno.test("rejects non-record aliases", () => {
  assertThrows(() =>
    emitTypeAlias(
      { kind: "TypeAliasDecl", exported: false, name: "Bad", type: named("i32"), span },
      context(),
    )
  );
});

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function context(
  typeAliases: [Str, TypeAliasDecl][] = [],
): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return {
    typeAliases: new Map<Str, TypeAliasDecl>(typeAliases),
    functions: new Map<Str, FunctionDecl>(),
  };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertThrows(run: () => void): void {
  let threw: b8 = false;
  try {
    run();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Expected throw");
}
