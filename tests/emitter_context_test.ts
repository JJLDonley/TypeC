import type { FunctionDecl, TypeAliasDecl } from "../src/ast.ts";
import type { CheckedProgram } from "../src/checker.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { createEmitContext } from "../src/emitter_context.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("creates emitter context indexes", () => {
  const typeAlias = recordAlias("Pair");
  const fn = functionDecl("main");
  const context = createEmitContext(program([typeAlias], [fn]));

  assertText(context.typeAliases.get("Pair")?.name ?? "", "Pair");
  assertText(context.functions.get("main")?.name ?? "", "main");
});

function program(typeAliases: TypeAliasDecl[], functions: FunctionDecl[]): CheckedProgram {
  return {
    kind: "Program",
    imports: [],
    typeAliases,
    functions,
    span,
    symbols: [],
    scopes: [],
    expressionTypes: new Map(),
  };
}

function recordAlias(name: Str): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    type: { kind: "RecordTypeRef", fields: [], span },
    span,
  };
}

function functionDecl(name: Str): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external: false,
    name,
    params: [],
    returnType: { kind: "NamedTypeRef", name: "i32", span },
    body: null,
    span,
  };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
