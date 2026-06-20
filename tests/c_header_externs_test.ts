import type { CHeaderFunction } from "c/header/ast.ts";
import { formatHeaderExterns } from "c/header/externs.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("formats supported C header externs", () => {
  const output = formatHeaderExterns([
    fn("add", "int32_t", [{ name: "left", type: "int32_t" }, { name: "right", type: "int32_t" }]),
    fn("copy", "void *", [{ name: "dst", type: "void *" }, { name: "src", type: "const void *" }]),
    fn("fill", "void", [{ name: "items", type: "int32_t[4]" }]),
    fn("nested", "void", [{ name: "items", type: "int32_t[2][3]" }]),
    fn(
      "set_callback",
      "void",
      [{ name: "callback", type: "int32_t (*)(int32_t)" }],
      "void (int32_t (*)(int32_t))",
    ),
    fn("platform", "int", [{ name: "value", type: "unsigned long" }]),
    fn("log", "int32_t", [{ name: "format", type: "const char *" }], "int32_t (const char *, ...)"),
  ]);

  assertIncludes(output, "extern function add(left: i32, right: i32): i32;");
  assertIncludes(output, "extern function copy(dst: void*, src: void*): void*;");
  assertIncludes(output, "extern function fill(items: i32[]): void;");
  assertIncludes(output, "extern function nested(items: Array<Array<i32, 3>, 2>): void;");
  assertIncludes(output, "extern function set_callback(callback: (arg0: i32) => i32): void;");
  assertIncludes(output, "extern function platform(value: c_ulong): c_int;");
  assertIncludes(output, "extern function log(format: u8*, ...args): i32;");
});

Deno.test("skips unsupported C header externs", () => {
  const output = formatHeaderExterns([
    fn("old", "void", [], "void ()"),
    fn("get_callback", "int32_t", [], "int32_t (*(void))(int32_t)"),
    fn("helper", "int32_t", [], "int32_t (void)", "/project/header.h", "static"),
    fn("defined", "int32_t", [], "int32_t (void)", "/project/header.h", null, true),
    fn("export", "void", [], "void (void)"),
    fn("bad_type", "__unsupported_t", [{ name: "value", type: "__unsupported_t" }]),
    fn("array_return", "int32_t[4]", []),
  ]);

  assertText(output, "");
});

Deno.test("keeps unlocated functions using known records", () => {
  const output = formatHeaderExterns(
    [
      fn("draw", "void", [{ name: "tint", type: "const Color *" }], "void (const Color *)", null),
      fn(
        "fill",
        "void",
        [{ name: "items", type: "struct Color[4]" }],
        "void (struct Color[4])",
        null,
      ),
      fn("skip", "void", [{ name: "value", type: "int32_t" }], "void (int32_t)", null),
    ],
    "/project/include",
    new Set(["Color"]),
  );

  assertIncludes(output, "extern function draw(tint: Color*): void;");
  assertIncludes(output, "extern function fill(items: Color[]): void;");
  assertExcludes(output, "skip");
});

Deno.test("deduplicates and filters C header externs", () => {
  const output = formatHeaderExterns([
    fn(
      "same",
      "int32_t",
      [{ name: "value", type: "int32_t" }],
      "int32_t (int32_t)",
      "/project/include/math.h",
    ),
    fn(
      "same",
      "__int32_t",
      [{ name: "value", type: "__int32_t" }],
      "__int32_t (__int32_t)",
      "/project/include/math.h",
    ),
    fn(
      "conflict",
      "int32_t",
      [{ name: "value", type: "int32_t" }],
      "int32_t (int32_t)",
      "/project/include/math.h",
    ),
    fn(
      "conflict",
      "int64_t",
      [{ name: "value", type: "int64_t" }],
      "int64_t (int64_t)",
      "/project/include/math.h",
    ),
    fn("outside", "int32_t", [], "int32_t (void)", "/usr/include/math.h"),
  ], "/project/include");

  assertSame(countOccurrences(output, "extern function same"), 1);
  assertExcludes(output, "conflict");
  assertExcludes(output, "outside");
});

function fn(
  name: Str,
  returnType: Str,
  params: CHeaderFunction["params"],
  functionType: Str | null = null,
  sourceFile: Str | null = "/project/header.h",
  storageClass: Str | null = null,
  hasBody: b8 = false,
): CHeaderFunction {
  return {
    name,
    functionType: functionType ?? `${returnType} (${params.map((param) => param.type).join(", ")})`,
    returnType,
    params,
    sourceFile,
    storageClass,
    hasBody,
  };
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
