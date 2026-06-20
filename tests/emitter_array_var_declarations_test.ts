import type { Expression, FunctionDecl, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitArrayVarDecl } from "emitter/array_var_declarations.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits array variable declarations", () => {
  assertText(
    emitArrayVarDecl(
      varDecl(true, "xs", inferredArray(named("i32")), arrayLiteral([int("1"), int("2")])),
      context(),
    ),
    "i32 xs[2] = { 1, 2 };",
  );
});

Deno.test("emits fixed string array declarations", () => {
  assertText(
    emitArrayVarDecl(
      varDecl(false, "text", fixedArray(named("u8"), "3"), stringLiteral("hi")),
      context(),
    ),
    'const u8 text[3] = "hi";',
  );
});

Deno.test("rejects array declarations without array literals", () => {
  assertThrows(() =>
    emitArrayVarDecl(varDecl(false, "xs", inferredArray(named("i32")), int("1")), context())
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

function fixedArray(element: TypeRef, sizeText: Str): TypeRef {
  return { kind: "FixedArrayTypeRef", element, sizeText, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function stringLiteral(text: Str): Expression {
  return { kind: "StringLiteral", text, span };
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

function assertThrows(run: () => void): void {
  try {
    run();
  } catch {
    return;
  }
  throw new Error("Expected throw");
}
