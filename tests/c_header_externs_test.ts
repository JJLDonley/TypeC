import type { CHeaderFunction } from "c/header/ast.ts";
import { formatHeaderExterns } from "c/header/externs.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("formats supported C header externs", () => {
  const output = formatHeaderExterns([
    fn("add", "int32_t", [{ name: "left", type: "int32_t" }, { name: "right", type: "int32_t" }]),
    fn("copy", "void *", [{ name: "dst", type: "void *" }, { name: "src", type: "const void *" }]),
  ]);

  assertIncludes(output, "extern function add(left: i32, right: i32): i32;");
  assertIncludes(output, "extern function copy(dst: void*, src: void*): void*;");
});

Deno.test("skips unsupported C header externs", () => {
  const output = formatHeaderExterns([
    fn("log", "int32_t", [{ name: "format", type: "const char *" }], "int32_t (const char *, ...)"),
    fn("old", "void", [], "void ()"),
    fn("callback", "void", [{ name: "callback", type: "int32_t (*)(int32_t)" }], "void (int32_t (*)(int32_t))"),
    fn("helper", "int32_t", [], "int32_t (void)", "/project/header.h", "static"),
    fn("defined", "int32_t", [], "int32_t (void)", "/project/header.h", null, true),
    fn("export", "void", [], "void (void)"),
    fn("bad_type", "long", [{ name: "value", type: "long" }]),
  ]);

  assertText(output, "");
});

Deno.test("deduplicates and filters C header externs", () => {
  const output = formatHeaderExterns([
    fn("same", "int32_t", [{ name: "value", type: "int32_t" }], "int32_t (int32_t)", "/project/include/math.h"),
    fn("same", "__int32_t", [{ name: "value", type: "__int32_t" }], "__int32_t (__int32_t)", "/project/include/math.h"),
    fn("conflict", "int32_t", [{ name: "value", type: "int32_t" }], "int32_t (int32_t)", "/project/include/math.h"),
    fn("conflict", "int64_t", [{ name: "value", type: "int64_t" }], "int64_t (int64_t)", "/project/include/math.h"),
    fn("outside", "int32_t", [], "int32_t (void)", "/usr/include/math.h"),
  ], "/project/include");

  assertSame(countOccurrences(output, "extern function same"), 1);
  assertExcludes(output, "conflict");
  assertExcludes(output, "outside");
});

function fn(name: Str, returnType: Str, params: CHeaderFunction["params"], functionType: Str | null = null, sourceFile: Str | null = "/project/header.h", storageClass: Str | null = null, hasBody: b8 = false): CHeaderFunction {
  return { name, functionType: functionType ?? `${returnType} (${params.map((param) => param.type).join(", ")})`, returnType, params, sourceFile, storageClass, hasBody };
}

function countOccurrences(haystack: Str, needle: Str): usize {
  return haystack.split(needle).length - 1;
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertExcludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output to exclude ${needle}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
