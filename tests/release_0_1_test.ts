import { compileFile } from "driver/compiler.ts";
import { compilerVersion, versionText } from "driver/version.ts";

import config from "../deno.json" with { type: "json" };

type Str = string;

type ReleasePath = {
  path: Str;
};

const releaseDocuments: ReleasePath[] = [
  { path: "README.md" },
  { path: "CHANGELOG.md" },
  { path: "docs/0.1-release.md" },
  { path: "docs/language.md" },
  { path: "docs/c-emission.md" },
  { path: "TYPEC_PHASES.md" },
];

const releaseExamples: Str[] = [
  "arena_safe_pointer",
  "arithmetic",
  "arrays_tuples_slices",
  "borrowed_interfaces",
  "c_extern",
  "classes",
  "enums_unions",
  "generics_constraints",
  "hello",
  "main",
  "modules",
  "optionals",
  "records_structs",
  "stdlib_helpers",
];

Deno.test("0.1 release documents exist and link to implemented features", async () => {
  for (const document of releaseDocuments) await assertFileExists(document.path);
  await assertDocumentContains("README.md", ["TypeC 0.1", "docs/0.1-release.md"]);
  await assertDocumentContains("CHANGELOG.md", ["TypeC 0.1.0", "0.1-release.md"]);
  await assertDocumentContains("docs/0.1-release.md", [
    "TypeC 0.1.0",
    "docs/language.md",
    "docs/c-emission.md",
    "examples/0.1/",
    "TypeC 0.1.0",
  ]);
});

Deno.test("0.1 release examples are documented and compile", async () => {
  const releaseText = await Deno.readTextFile("docs/0.1-release.md");
  for (const example of releaseExamples) {
    const path: Str = `examples/0.1/${example}.tc`;
    assertIncludes(releaseText, `${example}.tc`);
    await assertFileExists(path);
    await compileFile(path, await Deno.makeTempDir());
  }
});

Deno.test("0.1 release build task gates full validation", () => {
  const buildTask: Str = config.tasks.build;
  assertIncludes(buildTask, "deno fmt");
  assertIncludes(buildTask, "deno task check");
  assertIncludes(buildTask, "deno task lint");
  assertIncludes(buildTask, "deno task test");
  assertIncludes(buildTask, "deno compile");
  assertIncludes(config.tasks.test, "deno test -A");
});

Deno.test("0.1 release version is fixed", () => {
  assertText(compilerVersion(), "0.1.2");
  assertText(versionText(), "TypeC 0.1.2");
});

async function assertFileExists(path: Str): Promise<void> {
  const stat = await Deno.stat(path);
  if (!stat.isFile) throw new Error(`Expected file: ${path}`);
}

async function assertDocumentContains(path: Str, fragments: Str[]): Promise<void> {
  const text = await Deno.readTextFile(path);
  for (const fragment of fragments) assertIncludes(text, fragment);
}

function assertIncludes(text: Str, fragment: Str): void {
  if (text.includes(fragment)) return;
  throw new Error(`Expected text to include ${fragment}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
