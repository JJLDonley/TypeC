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
  assertConfigError(`{"unknown":true}`, "project.json has unknown key 'unknown'");
  assertConfigError(`{"compiler":{"unknown":true}}`, "project.json compiler has unknown key 'unknown'");
  assertConfigError(`{"compiler":{"flags":[1]}}`, "project.json compiler.flags must be a string array");
  assertConfigError(`{"compiler":{"flags":["extra.c"]}}`, "project.json compiler.flags must contain flags only");
  assertConfigError(`{"compiler":{"flags":["-std=c11"]}}`, "project.json compiler.flags cannot override the C standard");
  assertConfigError(`{"compiler":{"flags":["-std"]}}`, "project.json compiler.flags cannot override the C standard");
  assertConfigError(`{"compiler":{"flags":["-o"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["-obad"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["-c"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-E"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-S"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-shared"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-I"]}}`, "project.json compiler flag '-I' must include its operand in the same argument");
  assertConfigError(`{"compiler":{"flags":["-include"]}}`, "project.json compiler flag '-include' must include its operand in the same argument");
  assertConfigError(`{"compiler":{"flags":["-x"]}}`, "project.json compiler.flags cannot override input language");
  assertConfigError(`{"dependencies":{"basic/math":"std/math.tc"}}`, "Dependency alias 'basic/math' must target a .tc import path");
  assertConfigError(`{"dependencies":{"./math.tc":"std/math.tc"}}`, "Dependency alias './math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"std/math.tc":"std/math.tc"}}`, "Dependency alias 'std/math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"/math.tc":"std/math.tc"}}`, "Dependency alias '/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"https://example.test/math.tc":"std/math.tc"}}`, "Dependency alias 'https://example.test/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/../math.tc":"std/math.tc"}}`, "Dependency alias 'basic/../math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/%2e%2e/math.tc":"std/math.tc"}}`, "Dependency alias 'basic/%2e%2e/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/math.tc":"std/math"}}`, "Dependency 'basic/math.tc' target must be a .tc file");
  assertConfigError(`{"dependencies":{"basic/math.tc":"https://example.test/math.tc"}}`, "Dependency 'basic/math.tc' target must be a local TypeC path");
  assertConfigError(`{"dependencies":{"basic/math.tc":"std/../math.tc"}}`, "Dependency 'basic/math.tc' std target must stay within std");
  assertConfigError(`{"dependencies":{"basic/math.tc":"std/%2e%2e/math.tc"}}`, "Dependency 'basic/math.tc' std target must stay within std");
  assertConfigError(`{"dependencies":{"basic/math.tc":"../math.tc"}}`, "Dependency 'basic/math.tc' target must stay within the project");
  assertConfigError(`{"dependencies":{"basic/math.tc":"lib/%2e%2e/math.tc"}}`, "Dependency 'basic/math.tc' target must stay within the project");
  assertConfigError(`{"dependencies":{"basic/math.tc":"lib/../math.tc"}}`, "Dependency 'basic/math.tc' target must stay within the project");
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
