import type { FunctionDecl, TypeRef } from "../src/ast.ts";
import type { SourceSpan } from "../src/diagnostics.ts";
import { checkMainFunction } from "checker/main.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("accepts valid main signatures", () => {
  assertLen(checkMainFunction(main(false, [], named("i32")), "i32").length, 0);
});

Deno.test("reports invalid main signatures", () => {
  const diagnostics = checkMainFunction(main(true, [{ name: "argc", type: named("i32"), span }], named("void")), "void");

  assertText(diagnostics[0]?.message ?? "", "Function 'main' cannot be extern");
  assertText(diagnostics[1]?.message ?? "", "Function 'main' cannot have parameters");
  assertText(diagnostics[2]?.message ?? "", "Function 'main' must return 'i32'");
});

function main(external: b8, params: FunctionDecl["params"], returnType: TypeRef): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: false,
    external,
    name: "main",
    params,
    returnType,
    body: null,
    span,
  };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
