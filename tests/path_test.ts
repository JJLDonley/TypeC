import { basenameNoExt, buildOutputPaths } from "../src/path.ts";

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

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
