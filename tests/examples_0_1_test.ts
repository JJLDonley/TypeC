import { nativeCompileArgs } from "c/compiler.ts";
import { compileFile } from "driver/compiler.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

type ExampleCase = {
  name: Str;
  path: Str;
};

const expectedExamples: Str[] = [
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

const snapshotExamples: Str[] = [
  "arena_safe_pointer",
  "borrowed_interfaces",
  "records_structs",
];

Deno.test("0.1 example suite contains required entrypoints", async () => {
  const examples = await exampleCases();
  assertTextList(examples.map((example) => example.name), expectedExamples);
});

Deno.test("0.1 examples compile", async () => {
  for (const example of await exampleCases()) await compileExample(example.path);
});

Deno.test("0.1 examples build with native C compiler", async () => {
  if (!await hasNativeCompiler()) return;
  for (const example of await exampleCases()) await buildExample(example.path);
});

Deno.test("0.1 representative generated C snapshots are stable", async () => {
  for (const name of snapshotExamples) await assertSnapshot(name);
});

async function exampleCases(): Promise<ExampleCase[]> {
  const cases: ExampleCase[] = [];
  for await (const entry of Deno.readDir("examples/0.1")) {
    if (!entry.isFile || !entry.name.endsWith(".tc")) continue;
    const name = entry.name.slice(0, -".tc".length);
    cases.push({ name, path: `examples/0.1/${entry.name}` });
  }
  return cases.sort((left, right) => left.name.localeCompare(right.name));
}

async function compileExample(path: Str): Promise<void> {
  await compileFile(path, await Deno.makeTempDir());
}

async function buildExample(path: Str): Promise<void> {
  const buildDir = await Deno.makeTempDir();
  const result = await compileFile(path, buildDir);
  const output = await new Deno.Command(nativeCompiler(), {
    args: nativeCompileArgs(result),
  }).output();
  if (output.success) return;
  throw new Error(decode(output.stderr));
}

async function assertSnapshot(name: Str): Promise<void> {
  const result = await compileFile(`examples/0.1/${name}.tc`, await Deno.makeTempDir());
  const expected = await Deno.readTextFile(`tests/snapshots/examples_0_1_${name}.c`);
  assertText(result.cSource, expected);
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

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error("Text mismatch");
}

function assertTextList(actual: Str[], expected: Str[]): void {
  const actualText = actual.join("\n");
  const expectedText = expected.join("\n");
  if (actualText !== expectedText) {
    throw new Error(`Expected:\n${expectedText}\nActual:\n${actualText}`);
  }
}
