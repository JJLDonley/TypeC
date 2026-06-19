import { hasUrlScheme, isAbsolutePosixPath, isImportAliasFilePath, isRelativeImportPath, isStdImportPath, isTypeCImportFile } from "../src/import_path_kinds.ts";

type b8 = boolean;

Deno.test("classifies import path kinds", () => {
  assertSame(isStdImportPath("std/math.tc"), true);
  assertSame(isRelativeImportPath("./math.tc"), true);
  assertSame(isRelativeImportPath("../math.tc"), true);
  assertSame(isTypeCImportFile("math.tc"), true);
  assertSame(isTypeCImportFile("math.h"), true);
  assertSame(isImportAliasFilePath("basic/math.tc"), true);
  assertSame(isAbsolutePosixPath("/project/math.tc"), true);
  assertSame(hasUrlScheme("https://example.test/math.tc"), true);
});

Deno.test("rejects non import path kinds", () => {
  assertSame(isStdImportPath("basic/math"), false);
  assertSame(isRelativeImportPath("basic/math"), false);
  assertSame(isTypeCImportFile("math"), false);
  assertSame(isImportAliasFilePath("basic/math"), false);
  assertSame(isAbsolutePosixPath("project/math.tc"), false);
  assertSame(hasUrlScheme("project/math.tc"), false);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
