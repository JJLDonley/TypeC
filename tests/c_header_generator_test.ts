import { generateExternsFromClangAst } from "../src/c_header_generator.ts";

type Str = string;
type usize = number;

Deno.test("generates externs from clang AST", () => {
  const output = generateExternsFromClangAst({
    kind: "TranslationUnitDecl",
    inner: [
      functionDecl("add_i32", "int32_t (int32_t, int32_t)", [param("left", "int32_t"), param("right", "int32_t")]),
      functionDecl("add_i32", "int32_t (int32_t, int32_t)", [param("left", "int32_t"), param("right", "int32_t")]),
      functionDecl("conflict", "int32_t (int32_t)", [param("value", "int32_t")]),
      functionDecl("conflict", "int64_t (int64_t)", [param("value", "int64_t")]),
      functionDecl("set_name", "void (const char *)", [param("name", "const char *")]),
      functionDecl("copy_ptr", "void *(void *, const void *)", [param("dst", "void *"), param("src", "const void *")]),
      functionDecl("use_keyword", "void (int32_t, int32_t)", [param("function", "int32_t"), param("function", "int32_t")]),
      functionDecl("export", "void (void)", []),
      staticFunctionDecl("helper", "int32_t (int32_t)", [param("value", "int32_t")]),
      definedFunctionDecl("defined", "int32_t (int32_t)", [param("value", "int32_t")]),
      functionDecl("unsupported", "long (long)", [param("value", "long")]),
      functionDecl("log_message", "int (const char *, ...)", [param("format", "const char *")]),
    ],
  });

  assertIncludes(output, "extern function add_i32(left: i32, right: i32): i32;");
  assertSame(countOccurrences(output, "extern function add_i32"), 1);
  assertExcludes(output, "extern function conflict");
  assertIncludes(output, "extern function set_name(name: u8*): void;");
  assertIncludes(output, "extern function copy_ptr(dst: void*, src: void*): void*;");
  assertIncludes(output, "extern function use_keyword(arg_function: i32, arg_function_1: i32): void;");
  assertExcludes(output, "extern function export");
  assertExcludes(output, "extern function helper");
  assertExcludes(output, "extern function defined");
  assertExcludes(output, "unsupported");
  assertExcludes(output, "log_message");
});

function functionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, inner };
}

function staticFunctionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, storageClass: "static", inner };
}

function definedFunctionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, inner: [...inner, { kind: "CompoundStmt" }] };
}

function param(name: Str, qualType: Str): unknown {
  return { kind: "ParmVarDecl", name, type: { qualType } };
}

function countOccurrences(haystack: Str, needle: Str): usize {
  return haystack.split(needle).length - 1;
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertExcludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output to exclude ${needle}`);
}
