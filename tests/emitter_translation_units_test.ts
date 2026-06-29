import type { CheckedProgram } from "checker";
import type { Expression, FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { emitTranslationUnit } from "emitter/translation_units.ts";

type Str = string;
type b8 = boolean;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("emits complete translation units", () => {
  const c = emitTranslationUnit(program([], [fn("main", false, false, named("i32"))]));

  assertIncludes(c, "typedef int32_t  i32;");
  assertIncludes(c, "i32 main(void);");
  assertIncludes(c, "i32 main(void) {\n  return 42;\n}");
});

Deno.test("emits only required headers without arena runtime", () => {
  const c = emitTranslationUnit(program([], [fn("main", false, false, named("i32"))]));

  assertIncludes(c, "#include <stdint.h>");
  assertIncludes(c, "#include <stdbool.h>");
  assertIncludes(c, "#include <stddef.h>");
  assertNotIncludes(c, "#include <stdlib.h>");
});

Deno.test("emits fixed-width C ABI aliases", () => {
  const c = emitTranslationUnit(program([], [fn("main", false, false, named("i32"))]));

  assertIncludes(c, "typedef i32 c_int;");
  assertIncludes(c, "typedef i64 c_long;");
  assertNotIncludes(c, "typedef int c_int;");
  assertNotIncludes(c, "typedef long c_long;");
});

Deno.test("emits type aliases before prototypes", () => {
  const c = emitTranslationUnit(
    program([alias("Point")], [fn("main", false, false, named("i32"))]),
  );

  assertOrdered(c, "} Point;", "i32 main(void);");
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
    expressionTypes: new Map<Str, { type: Str }>(),
  };
}

function fn(name: Str, exported: b8, external: b8, returnType: TypeRef): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported,
    external,
    name,
    params: [],
    returnType,
    body: {
      kind: "BlockStmt",
      statements: [{ kind: "ReturnStmt", expression: intLiteral("42"), span }],
      span,
    },
    span,
  };
}

function alias(name: Str): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name,
    type: { kind: "RecordTypeRef", fields: [{ name: "x", type: named("i32"), span }], span },
    span,
  };
}

function intLiteral(text: Str): Expression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertNotIncludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output not to include ${needle}`);
}

function assertOrdered(haystack: Str, first: Str, second: Str): void {
  const firstIndex = haystack.indexOf(first);
  const secondIndex = haystack.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    throw new Error(`Expected ${first} before ${second}`);
  }
}
