import { TypeCError } from "core/diagnostics.ts";
import { loadProgram } from "module/loader.ts";

type Str = string;
type usize = number;

Deno.test("loads imported exports", async () => {
  const program = await loadProgram("examples/import_main.tc");
  assertIncludes(program.functions.map((fn) => fn.name), "add");
  assertIncludes(program.functions.map((fn) => fn.name), "main");
});

Deno.test("loads namespace imported functions", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/math.tc`,
    `function inc(x: i32): i32 { return x + 1; } export function add(a: i32, b: i32): i32 { return inc(a + b); }`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import * as Math from "./math.tc"; function main(): i32 { return Math.add(1, 2); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  const imported = program.functions.find((fn) => fn.name === "Math.add");
  const dependency = program.functions.find((fn) => fn.name === "Math.inc");
  assertText(imported?.cName ?? "", "Math_add");
  assertText(dependency?.cName ?? "", "Math_inc");
});

Deno.test("loads namespace imported type aliases", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/types.tc`,
    `type Inner = { value: i32; }; export type Pair = { left: Inner; right: Inner; };`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import * as Types from "./types.tc"; function main(): i32 { const p: Types.Pair = { left: { value: 1 }, right: { value: 2 } }; return p.left.value; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  const imported = program.typeAliases.find((typeAlias) => typeAlias.name === "Types.Pair");
  const dependency = program.typeAliases.find((typeAlias) => typeAlias.name === "Types.Inner");
  assertText(imported?.cName ?? "", "Types_Pair");
  assertText(dependency?.cName ?? "", "Types_Inner");
});

Deno.test("loads imported type aliases", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/types.tc`, `export type Pair = { left: i32; right: i32; };`);
  await writeText(
    `${dir}/main.tc`,
    `import { Pair } from "./types.tc"; function main(): i32 { const p: Pair = { left: 1, right: 2 }; return p.left; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.typeAliases.map((typeAlias) => typeAlias.name), "Pair");
});

Deno.test("loads dependencies of imported functions", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/ops.tc`,
    `function inc(x: i32): i32 { return x + 1; } export function answer(): i32 { return inc(41); }`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { answer } from "./ops.tc"; function main(): i32 { return answer(); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "inc");
  assertIncludes(program.functions.map((fn) => fn.name), "answer");
});

Deno.test("merges repeated imports from one module", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/ops.tc`,
    `function inc(x: i32): i32 { return x + 1; } export function one(): i32 { return inc(0); } export function two(): i32 { return inc(1); }`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { one } from "./ops.tc"; import { two } from "./ops.tc"; function main(): i32 { return one() + two(); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("deduplicates canonical module paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/ops.tc`,
    `function inc(x: i32): i32 { return x + 1; } export function one(): i32 { return inc(0); } export function two(): i32 { return inc(1); }`,
  );
  await Deno.symlink(`${dir}/ops.tc`, `${dir}/alias.tc`);
  await writeText(
    `${dir}/main.tc`,
    `import { one } from "./ops.tc"; import { two } from "./alias.tc"; function main(): i32 { return one() + two(); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("deduplicates shared transitive imports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/util.tc`, `export function inc(x: i32): i32 { return x + 1; }`);
  await writeText(
    `${dir}/a.tc`,
    `import { inc } from "./util.tc"; export function a(): i32 { return inc(1); }`,
  );
  await writeText(
    `${dir}/b.tc`,
    `import { inc } from "./util.tc"; export function b(): i32 { return inc(2); }`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { a } from "./a.tc"; import { b } from "./b.tc"; function main(): i32 { return a() + b(); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertSame(countFunctions(program.functions.map((fn) => fn.name), "inc"), 1);
});

Deno.test("loads std imports", async () => {
  const program = await loadProgram("examples/std_math.tc");
  assertIncludes(program.functions.map((fn) => fn.name), "abs_i32");
  assertIncludes(program.functions.map((fn) => fn.name), "clamp_i32");
});

Deno.test("loads std imports outside project cwd", async () => {
  const cwd = Deno.cwd();
  const dir = await Deno.makeTempDir();
  try {
    Deno.chdir(dir);
    const program = await loadProgram(`${cwd}/examples/std_math.tc`);
    assertIncludes(program.functions.map((fn) => fn.name), "abs_i32");
  } finally {
    Deno.chdir(cwd);
  }
});

Deno.test("loads std project dependency imports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/project.json`, `{"dependencies":{"basic/math":"std/math.tc"}}`);
  await writeText(
    `${dir}/main.tc`,
    `import { abs_i32 } from "basic/math"; function main(): i32 { return abs_i32(0 - 1); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "abs_i32");
});

Deno.test("loads relative project dependency imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/lib`);
  await writeText(`${dir}/project.json`, `{"dependencies":{"basic/math":"lib/math.tc"}}`);
  await writeText(`${dir}/lib/math.tc`, `export function answer(): i32 { return 42; }`);
  await writeText(
    `${dir}/main.tc`,
    `import { answer } from "basic/math"; function main(): i32 { return answer(); }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "answer");
});

Deno.test("loads relative C header typedef record imports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/types.h`,
    `typedef struct Color { unsigned char r; unsigned char g; unsigned char b; unsigned char a; } Color; void draw(Color tint);`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { Color, draw } from "./types.h"; function main(): i32 { const c: Color = { r: 1, g: 2, b: 3, a: 4 }; draw(c); return c.r; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.typeAliases.map((typeAlias) => typeAlias.name), "Color");
  assertIncludes(program.functions.map((fn) => fn.name), "draw");
});

Deno.test("loads relative C header imports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/math.h`,
    `#include <stdint.h>\n#include <string.h>\nint32_t add_i32(int32_t left, int32_t right);`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { add_i32 } from "./math.h"; function main(): i32 { return 0; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  const names = program.functions.map((fn) => fn.name);
  assertIncludes(names, "add_i32");
  assertExcludes(names, "strlen");
});

Deno.test("loads C header project dependency imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await writeText(`${dir}/project.json`, `{"dependencies":{"basic/math":"include/math.h"}}`);
  await writeText(
    `${dir}/include/math.h`,
    `#include <stdint.h>\nint32_t add_i32(int32_t left, int32_t right);`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { add_i32 } from "basic/math"; extern function provide(): i32; function main(): i32 { return 0; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "add_i32");
});

Deno.test("loads C headers with project include flags", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await writeText(
    `${dir}/project.json`,
    `{"dependencies":{"basic/math":"include/math.h"},"compiler":{"flags":["-Iinclude"]}}`,
  );
  await writeText(`${dir}/include/types.h`, `#include <stdint.h>`);
  await writeText(
    `${dir}/include/math.h`,
    `#include "types.h"\nint32_t add_i32(int32_t left, int32_t right);`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { add_i32 } from "basic/math"; function main(): i32 { return 0; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "add_i32");
});

Deno.test("loads C headers with project system include flags", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await writeText(
    `${dir}/project.json`,
    `{"dependencies":{"basic/math":"include/math.h"},"compiler":{"flags":["-isysteminclude"]}}`,
  );
  await writeText(`${dir}/include/types.h`, `#include <stdint.h>`);
  await writeText(
    `${dir}/include/math.h`,
    `#include <types.h>\nint32_t add_i32(int32_t left, int32_t right);`,
  );
  await writeText(
    `${dir}/main.tc`,
    `import { add_i32 } from "basic/math"; function main(): i32 { return 0; }`,
  );
  const program = await loadProgram(`${dir}/main.tc`);
  assertIncludes(program.functions.map((fn) => fn.name), "add_i32");
});

Deno.test("rejects missing exports", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(`${dir}/math.tc`, `function hidden(): i32 { return 1; }`);
  await writeText(
    `${dir}/main.tc`,
    `import { hidden } from "./math.tc"; function main(): i32 { return hidden(); }`,
  );
  await assertLoadError(`${dir}/main.tc`, "Module does not export 'hidden'");
});

Deno.test("rejects missing modules", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { answer } from "./missing.tc"; function main(): i32 { return answer(); }`,
  );
  await assertLoadError(`${dir}/main.tc`, `Module not found '${dir}/missing.tc'`);
});

Deno.test("rejects unsupported import paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(
    `${dir}/main.tc`,
    "Import path 'math.tc' must be relative, std, or a project dependency",
  );
});

Deno.test("rejects std imports escaping std", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "std/../math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(`${dir}/main.tc`, "Std import path 'std/../math.tc' must stay within std");
});

Deno.test("rejects encoded std imports escaping std", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "std/%2e%2e/math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(
    `${dir}/main.tc`,
    "Import path 'std/%2e%2e/math.tc' must not contain encoded path segments",
  );
});

Deno.test("rejects encoded and backslash import separators", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "./math\\ops.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(`${dir}/main.tc`, "Import path './math\\ops.tc' must use / separators");

  await writeText(
    `${dir}/std.tc`,
    `import { add } from "std/..\\math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(`${dir}/std.tc`, "Import path 'std/..\\math.tc' must use / separators");

  await writeText(
    `${dir}/encoded.tc`,
    `import { add } from "./math%2fops.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(`${dir}/encoded.tc`, "Import path './math%2fops.tc' must use / separators");
});

Deno.test("rejects encoded dot import segments", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "./%2e%2e/math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(
    `${dir}/main.tc`,
    "Import path './%2e%2e/math.tc' must not contain encoded path segments",
  );

  await writeText(
    `${dir}/dot.tc`,
    `import { add } from "./%2e/math.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(
    `${dir}/dot.tc`,
    "Import path './%2e/math.tc' must not contain encoded path segments",
  );
});

Deno.test("rejects malformed encoded import paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "./math%zz.tc"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(
    `${dir}/main.tc`,
    "Import path './math%zz.tc' contains invalid percent encoding",
  );
});

Deno.test("rejects non-TypeC import paths", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/main.tc`,
    `import { add } from "./math"; function main(): i32 { return 0; }`,
  );
  await assertLoadError(`${dir}/main.tc`, "Import path './math' must target a .tc or .h file");
});

Deno.test("rejects import cycles", async () => {
  const dir = await Deno.makeTempDir();
  await writeText(
    `${dir}/a.tc`,
    `import { b } from "./b.tc"; export function a(): i32 { return b(); }`,
  );
  await writeText(
    `${dir}/b.tc`,
    `import { a } from "./a.tc"; export function b(): i32 { return a(); }`,
  );
  await assertLoadError(`${dir}/a.tc`, `Import cycle involving '${dir}/a.tc'`);
});

async function assertLoadError(path: Str, message: Str): Promise<void> {
  try {
    await loadProgram(path);
  } catch (error) {
    if (
      error instanceof TypeCError &&
      error.diagnostics.some((diagnostic) => diagnostic.message === message)
    ) return;
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

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
  }
}

function assertExcludes(values: Str[], expected: Str): void {
  if (values.includes(expected)) {
    throw new Error(`Expected ${JSON.stringify(values)} to exclude ${expected}`);
  }
}
