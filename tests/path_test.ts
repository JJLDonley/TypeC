import {
  basenameNoExt,
  buildOutputPaths,
  directoryOf,
  fileDirectoryUrl,
  fileUrlPath,
  isPathWithinDir,
  normalizePath,
  stripTrailingSlash,
} from "paths";

type Str = string;
type b8 = boolean;

Deno.test("normalizes paths", () => {
  assertEquals(normalizePath("/project/main.tc"), "/project/main.tc");
  assertEquals(normalizePath("main.tc"), `${Deno.cwd()}/main.tc`);
});

Deno.test("gets basename without extension", () => {
  assertEquals(basenameNoExt("examples/main.tc"), "main");
  assertEquals(basenameNoExt("main"), "main");
});

Deno.test("builds file URL helpers", () => {
  assertEquals(fileDirectoryUrl("/project/src/main.tc").href, "file:///project/src/");
  assertEquals(fileUrlPath(new URL("file:///project/src/main.tc")), "/project/src/main.tc");
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

Deno.test("checks directory containment", () => {
  assertBool(isPathWithinDir("/project/include", "/project/include/"), true);
  assertBool(isPathWithinDir("/project/include/math.h", "/project/include"), true);
  assertBool(isPathWithinDir("/project/included/math.h", "/project/include"), false);
});

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
