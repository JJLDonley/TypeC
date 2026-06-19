import { loadProjectConfig, parseProjectConfig } from "../src/project_config.ts";
import { TypeCError } from "../src/diagnostics.ts";

type Str = string;

Deno.test("parses project dependencies and compiler flags", () => {
  const config = parseProjectConfig(`{"dependencies":{"basic/math.tc":"std/math.tc"},"compiler":{"flags":["-O2"]}}`, "/project");
  assertSame(config.projectDir, "/project");
  assertSame(config.dependencies.get("basic/math.tc"), "std/math.tc");
  assertEqualText(config.compilerFlags, ["-O2"]);
});

Deno.test("loads nearest project config", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/src`);
  await Deno.writeTextFile(`${dir}/project.json`, `{"compiler":{"flags":["-Wall"]}}`);
  await Deno.writeTextFile(`${dir}/src/main.tc`, `function main(): i32 { return 0; }`);
  const config = await loadProjectConfig(`${dir}/src/main.tc`);
  assertSame(config.projectDir, dir);
  assertEqualText(config.compilerFlags, ["-Wall"]);
});

Deno.test("rejects invalid project config", () => {
  assertConfigError(`{"compiler":{"flags":[1]}}`, "project.json compiler.flags must be a string array");
  assertConfigError(`{"dependencies":{"basic/math":"std/math.tc"}}`, "Dependency alias 'basic/math' must target a .tc import path");
  assertConfigError(`{"dependencies":{"./math.tc":"std/math.tc"}}`, "Dependency alias './math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"std/math.tc":"std/math.tc"}}`, "Dependency alias 'std/math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"basic/math.tc":"std/math"}}`, "Dependency 'basic/math.tc' target must be a .tc file");
});

function assertConfigError(text: Str, message: Str): void {
  try {
    parseProjectConfig(text, "/project");
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected config error: ${message}`);
}

function assertSame(actual: Str | undefined, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
