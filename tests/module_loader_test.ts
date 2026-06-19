import { TypeCError } from "../src/diagnostics.ts";
import { loadProgram } from "../src/module_loader.ts";

type Str = string;
type usize = number;

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

Deno.test("merges repeated imports from one module", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/ops.tc`, `function inc(x: i32): i32 { return x + 1; } export function one(): i32 { return inc(0); } export function two(): i32 { return inc(1); }`);
  await writeText(`${dir}/main.tc`, `import { one } from "./ops.tc"; import { two } from "./ops.tc"; function main(): i32 { return one() + two(); }`);
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("deduplicates canonical module paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/ops.tc`, `function inc(x: i32): i32 { return x + 1; } export function one(): i32 { return inc(0); } export function two(): i32 { return inc(1); }`);
  await Deno.symlink(`${dir}/ops.tc`, `${dir}/alias.tc`);
  await writeText(`${dir}/main.tc`, `import { one } from "./ops.tc"; import { two } from "./alias.tc"; function main(): i32 { return one() + two(); }`);
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("deduplicates shared transitive imports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/util.tc`, `export function inc(x: i32): i32 { return x + 1; }`);
  await writeText(`${dir}/a.tc`, `import { inc } from "./util.tc"; export function a(): i32 { return inc(1); }`);
  await writeText(`${dir}/b.tc`, `import { inc } from "./util.tc"; export function b(): i32 { return inc(2); }`);
  await writeText(`${dir}/main.tc`, `import { a } from "./a.tc"; import { b } from "./b.tc"; function main(): i32 { return a() + b(); }`);
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("rejects missing exports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/math.tc`, `function hidden(): i32 { return 1; }`);
  await writeText(`${dir}/main.tc`, `import { hidden } from "./math.tc"; function main(): i32 { return hidden(); }`);
  await assertLoadError(`${dir}/main.tc`, "Module does not export 'hidden'");
});

Deno.test("rejects non-relative import paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/main.tc`, `import { add } from "math.tc"; function main(): i32 { return 0; }`);
  await assertLoadError(`${dir}/main.tc`, "Import path 'math.tc' must be relative");
});

Deno.test("rejects non-TypeC import paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/main.tc`, `import { add } from "./math"; function main(): i32 { return 0; }`);
  await assertLoadError(`${dir}/main.tc`, "Import path './math' must target a .tc file");
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

function countFunctions(names: Str[], expected: Str): usize {
  return names.filter((name) => name === expected).length;
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
}
