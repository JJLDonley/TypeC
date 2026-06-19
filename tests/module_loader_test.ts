import { TypeCError } from "../src/diagnostics.ts";
import { loadProgram } from "../src/module_loader.ts";

type Str = string;

Deno.test("loads imported exports", async () => {
  const program = await loadProgram("examples/import_main.tc");
  assertIncludes(program.functions.map((fn) => fn.name), "add");
  assertIncludes(program.functions.map((fn) => fn.name), "main");
});

Deno.test("loads imported type aliases", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/types.tc`, `export type Pair = { left: i32; right: i32; };`);
  await writeText(`${dir}/main.tc`, `import { Pair } from "./types.tc"; function main(): i32 { const p: Pair = { left: 1, right: 2 }; return p.left; }`);
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.typeAliases.map((typeAlias) => typeAlias.name), "Pair");
});

Deno.test("loads dependencies of imported functions", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/ops.tc`, `function inc(x: i32): i32 { return x + 1; } export function answer(): i32 { return inc(41); }`);
  await writeText(`${dir}/main.tc`, `import { answer } from "./ops.tc"; function main(): i32 { return answer(); }`);
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "inc");
  assertIncludes(program.functions.map((fn) => fn.name), "answer");
});

Deno.test("rejects missing exports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/math.tc`, `function hidden(): i32 { return 1; }`);
  await writeText(`${dir}/main.tc`, `import { hidden } from "./math.tc"; function main(): i32 { return hidden(); }`);
  await assertLoadError(`${dir}/main.tc`, "Module does not export 'hidden'");
});

Deno.test("rejects import cycles", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/a.tc`, `import { b } from "./b.tc"; export function a(): i32 { return b(); }`);
  await writeText(`${dir}/b.tc`, `import { a } from "./a.tc"; export function b(): i32 { return a(); }`);
  await assertLoadError(`${dir}/a.tc`, `Import cycle involving '${dir}/a.tc'`);
});

async function assertLoadError(path: Str, message: Str): Promise<void> {
  try {
    await loadProgram(path);
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected loader error: ${message}`);
}

async function writeText(path: Str, content: Str): Promise<void> {
  await Deno.writeTextFile(path, content);
}

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
}
