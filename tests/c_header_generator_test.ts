import { generateExternsFromClangAst } from "../src/c_header_generator.ts";

type Str = string;

Deno.test("generates externs from clang AST", () => {
  const output = generateExternsFromClangAst({
    kind: "TranslationUnitDecl",
    inner: [
      functionDecl("add_i32", "int32_t (int32_t, int32_t)", [param("left", "int32_t"), param("right", "int32_t")]),
      functionDecl("unsupported", "long (long)", [param("value", "long")]),
    ],
  });

  assertIncludes(output, "extern function add_i32(left: i32, right: i32): i32;");
  assertExcludes(output, "unsupported");
});

function functionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, inner };
}

function param(name: Str, qualType: Str): unknown {
  return { kind: "ParmVarDecl", name, type: { qualType } };
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertExcludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output to exclude ${needle}`);
}
