import { loadProjectConfig, parseProjectConfig } from "project/config.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

Deno.test("parses project dependencies and compiler flags", () => {
  const config = parseProjectConfig(`{"dependencies":{"basic/math":"std/math.tc","raylib":"vendor/raylib.h"},"compiler":{"flags":["-O2"]}}`, "/project");
  assertSame(config.projectDir, "/project");
  assertSame(config.dependencies.get("basic/math"), "std/math.tc");
  assertSame(config.dependencies.get("raylib"), "vendor/raylib.h");
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
  assertConfigError(`{"compiler":{"flags":["--output"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["--output=bad"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["-Wl,-o,bad"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["-Wl,--output=bad"]}}`, "project.json compiler.flags cannot override output paths");
  assertConfigError(`{"compiler":{"flags":["-c"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-E"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-S"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-M"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-MM"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-fsyntax-only"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-shared"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-Wl,-shared"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-Wl,-r"]}}`, "project.json compiler.flags cannot change build artifact mode");
  assertConfigError(`{"compiler":{"flags":["-e"]}}`, "project.json compiler.flags cannot override the program entrypoint");
  assertConfigError(`{"compiler":{"flags":["-Wl,-e,custom_start"]}}`, "project.json compiler.flags cannot override the program entrypoint");
  assertConfigError(`{"compiler":{"flags":["-Wl,-emain"]}}`, "project.json compiler.flags cannot override the program entrypoint");
  assertConfigError(`{"compiler":{"flags":["-Wl,-e=custom_start"]}}`, "project.json compiler.flags cannot override the program entrypoint");
  assertConfigError(`{"compiler":{"flags":["-Wl,--entry=custom_start"]}}`, "project.json compiler.flags cannot override the program entrypoint");
  assertConfigError(`{"compiler":{"flags":["-nostdlib"]}}`, "project.json compiler.flags cannot remove the hosted C environment");
  assertConfigError(`{"compiler":{"flags":["-nodefaultlibs"]}}`, "project.json compiler.flags cannot remove the hosted C environment");
  assertConfigError(`{"compiler":{"flags":["-nostartfiles"]}}`, "project.json compiler.flags cannot remove the hosted C environment");
  assertConfigError(`{"compiler":{"flags":["-nostdinc"]}}`, "project.json compiler.flags cannot remove the hosted C environment");
  assertConfigError(`{"compiler":{"flags":["-ffreestanding"]}}`, "project.json compiler.flags cannot remove the hosted C environment");
  assertConfigError(`{"compiler":{"flags":["-target"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-target=wasm32"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["--target=wasm32"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-arch"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-m32"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-march=native"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-mcpu=native"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-mtune=native"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["--sysroot=/sdk"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-isysroot/sdk"]}}`, "project.json compiler.flags cannot override the target environment");
  assertConfigError(`{"compiler":{"flags":["-I"]}}`, "project.json compiler flag '-I' must include its operand in the same argument");
  assertConfigError(`{"compiler":{"flags":["-include"]}}`, "project.json compiler.flags cannot force source includes");
  assertConfigError(`{"compiler":{"flags":["-includeconfig.h"]}}`, "project.json compiler.flags cannot force source includes");
  assertConfigError(`{"compiler":{"flags":["-imacrosmacros.h"]}}`, "project.json compiler.flags cannot force source includes");
  assertConfigError(`{"compiler":{"flags":["-include-pchprefix.pch"]}}`, "project.json compiler.flags cannot force source includes");
  assertConfigError(`{"compiler":{"flags":["-x"]}}`, "project.json compiler.flags cannot override input language");
  assertConfigError(`{"compiler":{"flags":["-xc++"]}}`, "project.json compiler.flags cannot override input language");
  assertConfigError(`{"dependencies":{"./math.tc":"std/math.tc"}}`, "Dependency alias './math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"std/math.tc":"std/math.tc"}}`, "Dependency alias 'std/math.tc' must not be relative or std");
  assertConfigError(`{"dependencies":{"/math.tc":"std/math.tc"}}`, "Dependency alias '/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"https://example.test/math.tc":"std/math.tc"}}`, "Dependency alias 'https://example.test/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/../math.tc":"std/math.tc"}}`, "Dependency alias 'basic/../math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/%2e%2e/math.tc":"std/math.tc"}}`, "Dependency alias 'basic/%2e%2e/math.tc' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"":"std/math.tc"}}`, "Dependency alias '' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic//math":"std/math.tc"}}`, "Dependency alias 'basic//math' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/":"std/math.tc"}}`, "Dependency alias 'basic/' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/./math":"std/math.tc"}}`, "Dependency alias 'basic/./math' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/%2e/math":"std/math.tc"}}`, "Dependency alias 'basic/%2e/math' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic%2fmath":"std/math.tc"}}`, "Dependency alias 'basic%2fmath' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic%5cmath":"std/math.tc"}}`, "Dependency alias 'basic%5cmath' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic\\\\math":"std/math.tc"}}`, "Dependency alias 'basic\\math' must be a project dependency import path");
  assertConfigError(`{"dependencies":{"basic/math.tc":"std/math.tc"}}`, "Dependency alias 'basic/math.tc' must not include a file extension");
  assertConfigError(`{"dependencies":{"raylib.h":"vendor/raylib.h"}}`, "Dependency alias 'raylib.h' must not include a file extension");
  assertConfigError(`{"dependencies":{"basic/math":"std/math"}}`, "Dependency 'basic/math' target must be a .tc or .h file");
  assertConfigError(`{"dependencies":{"basic/math":"https://example.test/math.tc"}}`, "Dependency 'basic/math' target must be a local dependency path");
  assertConfigError(`{"dependencies":{"basic/math":"vendor\\\\math.tc"}}`, "Dependency 'basic/math' target must be a local dependency path");
  assertConfigError(`{"dependencies":{"basic/math":"vendor%2fmath.tc"}}`, "Dependency 'basic/math' target must be a local dependency path");
  assertConfigError(`{"dependencies":{"basic/math":"vendor%5cmath.tc"}}`, "Dependency 'basic/math' target must be a local dependency path");
  assertConfigError(`{"dependencies":{"basic/math":"std/../math.tc"}}`, "Dependency 'basic/math' std target must stay within std");
  assertConfigError(`{"dependencies":{"basic/math":"std/%2e%2e/math.tc"}}`, "Dependency 'basic/math' std target must stay within std");
  assertConfigError(`{"dependencies":{"basic/math":"../math.tc"}}`, "Dependency 'basic/math' target must stay within the project");
  assertConfigError(`{"dependencies":{"basic/math":"lib/%2e%2e/math.tc"}}`, "Dependency 'basic/math' target must stay within the project");
  assertConfigError(`{"dependencies":{"basic/math":"lib/../math.tc"}}`, "Dependency 'basic/math' target must stay within the project");
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
