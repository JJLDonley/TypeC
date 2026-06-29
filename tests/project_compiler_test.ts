import { TypeCError } from "core/diagnostics.ts";
import { readProjectCompilerFlags } from "project/compiler.ts";

type Str = string;
type usize = number;

Deno.test("reads project compiler flags", () => {
  const flags = readProjectCompilerFlags({ flags: ["-O2", "-Iinclude", "-DNAME=1"] });

  assertSame(flags.length, 3);
  assertText(flags[0] ?? "", "-O2");
});

Deno.test("reads absent project compiler flags", () => {
  assertSame(readProjectCompilerFlags(undefined).length, 0);
  assertSame(readProjectCompilerFlags({}).length, 0);
});

Deno.test("rejects invalid project compiler config", () => {
  assertCompilerError([], "project.json compiler must be an object", "E2906");
  assertCompilerError({ unknown: [] }, "project.json compiler has unknown key 'unknown'", "E2902");
  assertCompilerError(
    { flags: ["-O2", 1] },
    "project.json compiler.flags must be a string array",
    "E2907",
  );
  assertCompilerError(
    { flags: ["-std=c99"] },
    "project.json compiler.flags cannot override the C standard",
    "E2908",
  );
});

function assertCompilerError(value: unknown, message: Str, code: Str): void {
  try {
    readProjectCompilerFlags(value);
  } catch (error) {
    if (
      error instanceof TypeCError && error.diagnostics[0]?.message === message &&
      error.diagnostics[0]?.code === code
    ) return;
    throw error;
  }
  throw new Error(`Expected ${message}`);
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
