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
      functionDecl("add_internal", "__int32_t (__int32_t, __uint32_t)", [param("left", "__int32_t"), param("right", "__uint32_t")]),
      functionDecl("alias_width", "int32_t (int32_t)", [param("value", "int32_t")]),
      functionDecl("alias_width", "__int32_t (__int32_t)", [param("value", "__int32_t")]),
      functionDecl("copy_ptr", "void *(void *, const void *)", [param("dst", "void *"), param("src", "const void *")]),
      functionDecl("copy_text", "void (char *restrict, const char *restrict)", [param("dst", "char *restrict"), param("src", "const char *restrict")]),
      functionDecl("nullable_text", "void (char * _Nullable)", [param("text", "char * _Nullable")]),
      functionDecl("use_keyword", "void (int32_t, int32_t)", [param("function", "int32_t"), param("function", "int32_t")]),
      functionDecl("export", "void (void)", []),
      functionDecl("i32", "void (void)", []),
      staticFunctionDecl("helper", "int32_t (int32_t)", [param("value", "int32_t")]),
      definedFunctionDecl("defined", "int32_t (int32_t)", [param("value", "int32_t")]),
      functionDecl("unsupported", "long (long)", [param("value", "long")]),
      functionDecl("mixed", "int32_t (int32_t)", [param("value", "int32_t")]),
      functionDecl("mixed", "long (long)", [param("value", "long")]),
      functionDecl("log_message", "int (const char *, ...)", [param("format", "const char *")]),
      functionDecl("old_style", "void ()", []),
      functionDecl("get_callback", "int32_t (*(void))(int32_t)", []),
      functionDecl("set_callback", "void (int32_t (*)(int32_t))", [param("callback", "int32_t (*)(int32_t)")]),
    ],
  });

  assertIncludes(output, "extern function add_i32(left: i32, right: i32): i32;");
  assertSame(countOccurrences(output, "extern function add_i32"), 1);
  assertExcludes(output, "extern function conflict");
  assertIncludes(output, "extern function set_name(name: u8*): void;");
  assertIncludes(output, "extern function add_internal(left: i32, right: u32): i32;");
  assertIncludes(output, "extern function alias_width(value: i32): i32;");
  assertSame(countOccurrences(output, "extern function alias_width"), 1);
  assertIncludes(output, "extern function copy_ptr(dst: void*, src: void*): void*;");
  assertIncludes(output, "extern function copy_text(dst: u8*, src: u8*): void;");
  assertIncludes(output, "extern function nullable_text(text: u8*): void;");
  assertIncludes(output, "extern function use_keyword(arg_function: i32, arg_function_1: i32): void;");
  assertExcludes(output, "extern function export");
  assertExcludes(output, "extern function i32");
  assertExcludes(output, "extern function helper");
  assertExcludes(output, "extern function defined");
  assertExcludes(output, "unsupported");
  assertIncludes(output, "extern function mixed(value: i32): i32;");
  assertSame(countOccurrences(output, "extern function mixed"), 1);
  assertExcludes(output, "log_message");
  assertExcludes(output, "old_style");
  assertExcludes(output, "get_callback");
  assertExcludes(output, "set_callback");
});

Deno.test("filters generated externs to requested header directory", () => {
  const output = generateExternsFromClangAst({
    kind: "TranslationUnitDecl",
    inner: [
      locatedFunctionDecl("local_add", "int32_t (int32_t)", [param("value", "int32_t")], "/project/include/math.h"),
      locatedFunctionDecl("system_add", "int32_t (int32_t)", [param("value", "int32_t")], "/usr/include/math.h"),
      functionDecl("unknown_add", "int32_t (int32_t)", [param("value", "int32_t")]),
    ],
  }, "/project/include");

  assertIncludes(output, "extern function local_add(value: i32): i32;");
  assertExcludes(output, "system_add");
  assertExcludes(output, "unknown_add");
});

function functionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, inner };
}

function staticFunctionDecl(name: Str, qualType: Str, inner: unknown[]): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, storageClass: "static", inner };
}

function locatedFunctionDecl(name: Str, qualType: Str, inner: unknown[], file: Str): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, loc: { file }, inner };
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
