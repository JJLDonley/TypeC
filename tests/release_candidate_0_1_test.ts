import { nativeCompileArgs } from "c/compiler.ts";
import { compileFile } from "driver/compiler.ts";
import { versionText } from "driver/version.ts";
import * as diagnosticCodes from "core/diagnostic_codes.ts";

type Str = string;
type b8 = boolean;

type CommandCase = {
  args: Str[];
  buildDir: b8;
};

const releaseCandidateTag: Str = "typec-0.1.0-rc.1";
const mainExamplePath: Str = "examples/0.1/main.tc";

const scalarPrelude: Str = `#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

typedef uint8_t  u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;
typedef int8_t   i8;
typedef int16_t  i16;
typedef int32_t  i32;
typedef int64_t  i64;
typedef float    f32;
typedef double   f64;
typedef bool     b8;
typedef size_t   usize;`;

const releaseCommands: CommandCase[] = [
  { args: ["run", "-A", "src/driver/main.ts", "check", mainExamplePath], buildDir: false },
  { args: ["run", "-A", "src/driver/main.ts", "build", mainExamplePath], buildDir: true },
  { args: ["run", "-A", "src/driver/main.ts", "run", mainExamplePath], buildDir: true },
];

Deno.test("0.1 release-candidate documents freeze tag", async () => {
  await assertDocumentContains("docs/0.1-release-candidate.md", [
    releaseCandidateTag,
    "docs/diagnostics.md",
    "docs/c-emission.md",
    "examples/0.1/main.tc",
    "TypeC 0.1.0",
  ]);
  await assertDocumentContains("CHANGELOG.md", [releaseCandidateTag]);
  await assertDocumentContains("docs/0.1-release.md", ["docs/0.1-release-candidate.md"]);
});

Deno.test("0.1 diagnostic code names are frozen and documented", async () => {
  const docs = await Deno.readTextFile("docs/diagnostics.md");
  for (const [name, code] of diagnosticCodeEntries()) {
    assertIncludes(docs, `| \`${code}\` | \`${name}\``);
  }
});

Deno.test("0.1 emitted C ABI prelude is frozen", async () => {
  const result = await compileFile(mainExamplePath, await Deno.makeTempDir());
  assertIncludes(result.cSource, scalarPrelude);
  assertIncludes(result.cSource, "i32 main(void)");
  assertNotIncludes(result.cSource, "class dispatch table");
});

Deno.test("0.1 release main example check build and run commands succeed", async () => {
  if (!await hasNativeCompiler()) return;
  for (const commandCase of releaseCommands) await assertCommandSucceeds(commandCase);
});

Deno.test("all 0.1 examples compile to native C where available", async () => {
  if (!await hasNativeCompiler()) return;
  for await (const entry of Deno.readDir("examples/0.1")) {
    if (!entry.isFile || !entry.name.endsWith(".tc")) continue;
    const result = await compileFile(`examples/0.1/${entry.name}`, await Deno.makeTempDir());
    const output = await new Deno.Command(nativeCompiler(), {
      args: nativeCompileArgs(result),
    }).output();
    if (!output.success) throw new Error(decode(output.stderr));
  }
});

Deno.test("0.1 release version output is fixed", () => {
  assertText(versionText(), "TypeC 0.1.2");
});

function diagnosticCodeEntries(): [Str, Str][] {
  const entries: [Str, Str][] = [];
  for (const [name, value] of Object.entries(diagnosticCodes)) {
    if (isDiagnosticCode(value)) entries.push([name, value]);
  }
  return entries.sort((left, right) => left[1].localeCompare(right[1]));
}

function isDiagnosticCode(value: unknown): value is Str {
  return typeof value === "string" && /^E\d{4}$/.test(value);
}

async function assertDocumentContains(path: Str, fragments: Str[]): Promise<void> {
  const text = await Deno.readTextFile(path);
  for (const fragment of fragments) assertIncludes(text, fragment);
}

async function assertCommandSucceeds(commandCase: CommandCase): Promise<void> {
  const args = commandCase.buildDir
    ? [...commandCase.args, "--build-dir", await Deno.makeTempDir()]
    : commandCase.args;
  const output = await new Deno.Command("deno", { args }).output();
  if (output.success) return;
  throw new Error(decode(output.stderr));
}

async function hasNativeCompiler(): Promise<b8> {
  try {
    const output = await new Deno.Command(nativeCompiler(), { args: ["--version"] }).output();
    return output.success;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

function nativeCompiler(): Str {
  return "cc";
}

function decode(bytes: Uint8Array): Str {
  return new TextDecoder().decode(bytes);
}

function assertIncludes(text: Str, fragment: Str): void {
  if (text.includes(fragment)) return;
  throw new Error(`Expected text to include ${fragment}`);
}

function assertNotIncludes(text: Str, fragment: Str): void {
  if (!text.includes(fragment)) return;
  throw new Error(`Expected text not to include ${fragment}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
