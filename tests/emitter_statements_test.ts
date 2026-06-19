import type { Expression, Statement, TypeRef } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { createEmitContext, type EmitContext } from "../src/emitter_context.ts";
import { emitStatement } from "../src/emitter_statements.ts";

type Str = string;
type b8 = boolean;
type BoolText = "true" | "false";

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits return and variable statements", () => {
  assertText(emitStatement({ kind: "ReturnStmt", expression: int("7"), span }, "i32", context()), "return 7;");
  assertText(emitStatement(varDecl(false, "x", named("i32"), int("3")), "i32", context()), "const i32 x = 3;");
});

Deno.test("emits array variable statements", () => {
  assertText(
    emitStatement(varDecl(true, "xs", { kind: "InferredArrayTypeRef", element: named("i32"), span }, arrayLiteral([int("1"), int("2")])), "i32", context()),
    "i32 xs[2] = { 1, 2 };",
  );
});

Deno.test("emits control flow statements", () => {
  assertText(
    emitStatement({ kind: "WhileStmt", condition: bool("true"), body: block([{ kind: "ReturnStmt", expression: int("1"), span }]), span }, "i32", context()),
    "while (true) {\n    return 1;\n  }",
  );
  assertText(
    emitStatement({ kind: "IfStmt", condition: bool("false"), thenBody: block([{ kind: "ReturnStmt", expression: int("1"), span }]), elseBody: block([{ kind: "ReturnStmt", expression: int("2"), span }]), span }, "i32", context()),
    "if (false) {\n    return 1;\n  } else {\n    return 2;\n  }",
  );
});

function context(): EmitContext {
  return createEmitContext({
    kind: "Program",
    imports: [],
    typeAliases: [],
    functions: [],
    span,
    symbols: [],
    scopes: [],
    expressionTypes: new Map(),
  });
}

function block(statements: Statement[]) {
  return { kind: "BlockStmt" as const, statements, span };
}

function varDecl(mutable: b8, name: Str, type: TypeRef, initializer: Expression): Statement {
  return { kind: "VarDeclStmt", mutable, name, type, initializer, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function int(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function bool(text: BoolText): Expression {
  return { kind: "BoolLiteral", value: text === "true", text, span };
}

function arrayLiteral(elements: Expression[]): Expression {
  return { kind: "ArrayLiteralExpr", elements, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
