import type { CHeaderRecord } from "c/header/ast.ts";
import { formatHeaderRecordAliases } from "c/header/record_aliases.ts";

type Str = string;

Deno.test("formats supported C header record aliases", () => {
  const output = formatHeaderRecordAliases([
    record("Color", [["r", "unsigned char"], ["g", "unsigned char"], ["b", "unsigned char"], [
      "a",
      "unsigned char",
    ]]),
    record("Vec2", [["x", "float"], ["y", "float"]]),
    record("Paint", [["tint", "Color"]]),
  ]);

  assertIncludes(output, "export type Color = { r: u8; g: u8; b: u8; a: u8; };");
  assertIncludes(output, "export type Vec2 = { x: f32; y: f32; };");
  assertIncludes(output, "export type Paint = { tint: Color; };");
});

Deno.test("formats fixed C array record fields", () => {
  const output = formatHeaderRecordAliases([
    record("Color", [["r", "unsigned char"]]),
    record("Palette", [["colors", "Color[4]"]]),
  ]);

  assertIncludes(output, "export type Palette = { colors: Color[4]; };");
});

Deno.test("skips unsupported C header record aliases", () => {
  const output = formatHeaderRecordAliases([
    record("bad-name", [["x", "int32_t"]]),
    record("BadField", [["bad-name", "int32_t"]]),
    record("BadType", [["x", "__unsupported_t"]]),
  ]);

  assertText(output, "");
});

Deno.test("filters C header record aliases by include directory", () => {
  const output = formatHeaderRecordAliases([
    record("Local", [["x", "int32_t"]], "/project/include/local.h"),
    record("Outside", [["x", "int32_t"]], "/usr/include/outside.h"),
  ], "/project/include");

  assertIncludes(output, "export type Local");
  assertExcludes(output, "Outside");
});

function record(
  name: Str,
  fields: [Str, Str][],
  sourceFile: Str | null = "/project/header.h",
): CHeaderRecord {
  return {
    name,
    fields: fields.map(([fieldName, type]) => ({ name: fieldName, type })),
    sourceFile,
  };
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
