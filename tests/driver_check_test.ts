import { checkFile, compileFile, emitCFile } from "driver/compiler.ts";

type Str = string;
type b8 = boolean;

Deno.test("compiles TypeC files to selected build directory", async () => {
  const dir = await Deno.makeTempDir();
  const sourcePath = `${dir}/main.tc`;
  await Deno.writeTextFile(sourcePath, `function main(): i32 { return 0; }`);
  const result = await compileFile(sourcePath, `${dir}/out`);
  assertSame(result.cPath, `${dir}/out/main.c`);
  assertSame(await exists(result.cPath), true);
});

Deno.test("emits C text without writing artifacts", async () => {
  const dir = await Deno.makeTempDir();
  const sourcePath = `${dir}/main.tc`;
  const cPath = `${dir}/build/main.c`;
  await Deno.writeTextFile(sourcePath, `function value(): i32 { return 1; }`);
  const cSource = await emitCFile(sourcePath);
  assertContains(cSource, "i32 value(void)");
  assertSame(await exists(cPath), false);
});

Deno.test("checks TypeC files without emitting C", async () => {
  const dir = await Deno.makeTempDir();
  const sourcePath = `${dir}/main.tc`;
  const cPath = `${dir}/build/main.c`;
  await Deno.writeTextFile(sourcePath, `function value(): i32 { return 1; }`);
  await checkFile(sourcePath);
  assertSame(await exists(cPath), false);
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

function assertContains(text: Str, expected: Str): void {
  if (!text.includes(expected)) throw new Error(`Expected text containing ${expected}`);
}

function assertSame(actual: Str | b8, expected: Str | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
