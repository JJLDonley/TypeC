import type { Expression, FunctionDecl, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitVarDecl } from "emitter/var_declarations.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits scalar variable declarations", () => {
  assertText(
    emitVarDecl(varDecl(false, "x", named("i32"), int("3")), context()),
    "const i32 x = 3;",
  );
  assertText(emitVarDecl(varDecl(true, "x", named("i32"), int("3")), context()), "i32 x = 3;");
});

Deno.test("emits array variable declarations", () => {
  assertText(
    emitVarDecl(
      varDecl(true, "xs", inferredArray(named("i32")), arrayLiteral([int("1"), int("2")])),
      context(),
    ),
    "i32 xs[2] = { 1, 2 };",
  );
});

function varDecl(
  mutable: b8,
  name: Str,
  type: TypeRef,
  initializer: Expression,
): Extract<Statement, { kind: "VarDeclStmt" }> {
  return { kind: "VarDeclStmt", mutable, name, type, initializer, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function inferredArray(element: TypeRef): TypeRef {
  return { kind: "InferredArrayTypeRef", element, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function context(): { typeAliases: Map<Str, TypeAliasDecl>; functions: Map<Str, FunctionDecl> } {
  return { typeAliases: new Map<Str, TypeAliasDecl>(), functions: new Map<Str, FunctionDecl>() };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
