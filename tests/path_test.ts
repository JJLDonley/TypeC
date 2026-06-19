import { basenameNoExt, buildOutputPaths, directoryOf, stripTrailingSlash } from "../src/path.ts";

type Str = string;

Deno.test("gets basename without extension", () => {
  assertEquals(basenameNoExt("examples/main.tc"), "main");
  assertEquals(basenameNoExt("main"), "main");
});

Deno.test("builds output paths", () => {
  const paths = buildOutputPaths("examples/main.tc", "build");
  assertEquals(paths.cPath, "build/main.c");
  assertEquals(paths.exePath, "build/main");
});

Deno.test("gets directory names", () => {
  assertEquals(directoryOf("/project/src/main.tc"), "/project/src");
  assertEquals(directoryOf("/project/src/"), "/project");
  assertEquals(directoryOf("/main.tc"), "/");
});

Deno.test("strips trailing slashes", () => {
  assertEquals(stripTrailingSlash("/project/src/"), "/project/src");
  assertEquals(stripTrailingSlash("/"), "/");
  assertEquals(stripTrailingSlash("main.tc"), "main.tc");
});

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
