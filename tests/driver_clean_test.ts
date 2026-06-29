import { cleanSourceArtifacts } from "driver/clean.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("cleans generated source artifacts", async () => {
  const dir = await Deno.makeTempDir();
  const sourcePath = `${dir}/main.tc`;
  const cPath = `${dir}/out/main.c`;
  const exePath = `${dir}/out/main`;
  await Deno.mkdir(`${dir}/out`);
  await Deno.writeTextFile(cPath, "generated");
  await Deno.writeTextFile(exePath, "binary");
  const result = await cleanSourceArtifacts(sourcePath, `${dir}/out`);
  assertSame(await exists(cPath), false);
  assertSame(await exists(exePath), false);
  assertTextList(result.removedPaths, [cPath, exePath]);
});

Deno.test("ignores missing generated source artifacts", async () => {
  const dir = await Deno.makeTempDir();
  const result = await cleanSourceArtifacts(`${dir}/main.tc`, `${dir}/out`);
  assertTextList(result.removedPaths, []);
});

async function exists(path: Str): Promise<b8> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertTextList(actual: Str[], expected: Str[]): void {
  if (actual.length !== expected.length) {
    throw new Error(`Expected ${expected.length}, got ${actual.length}`);
  }
  for (let index: usize = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(`Expected ${expected[index]}, got ${actual[index]}`);
    }
  }
}
