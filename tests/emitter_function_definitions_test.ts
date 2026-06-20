import type { Expression, FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits function definitions", () => {
  assertText(
    emitFunctionDefinition(fn("main", false, false, [], named("i32")), context()),
    "i32 main(void) {\n  return 42;\n}",
  );
});

Deno.test("rejects declarations without body", () => {
  assertThrows(() =>
    emitFunctionDefinition(decl("missing", false, false, [], named("void")), context())
  );
});

function fn(
  name: Str,
  exported: b8,
  external: b8,
  params: FunctionDecl["params"],
  returnType: TypeRef,
): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported,
    external,
    name,
    params,
    returnType,
    body: {
      kind: "BlockStmt",
      statements: [{ kind: "ReturnStmt", expression: intLiteral("42"), span }],
      span,
    },
    span,
  };
}

function decl(
  name: Str,
  exported: b8,
  external: b8,
  params: FunctionDecl["params"],
  returnType: TypeRef,
): FunctionDecl {
  return { kind: "FunctionDecl", exported, external, name, params, returnType, body: null, span };
}

function intLiteral(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertThrows(run: () => void): void {
  try {
    run();
  } catch {
    return;
  }
  throw new Error("Expected throw");
}
