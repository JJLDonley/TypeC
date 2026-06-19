import { compilerFlagError } from "../src/compiler_flags.ts";

type Str = string;

Deno.test("accepts safe project compiler flags", () => {
  assertAllowed("-O2");
  assertAllowed("-Wall");
  assertAllowed("-Iinclude");
  assertAllowed("-DNAME=VALUE");
  assertAllowed("-UDEBUG");
});

Deno.test("rejects TypeC-controlled compiler flags", () => {
  assertRejected("main.c", "project.json compiler.flags must contain flags only");
  assertRejected("-std=c11", "project.json compiler.flags cannot override the C standard");
  assertRejected("--output=bad", "project.json compiler.flags cannot override output paths");
  assertRejected("-fsyntax-only", "project.json compiler.flags cannot change build artifact mode");
  assertRejected("-Wl,-emain", "project.json compiler.flags cannot override the program entrypoint");
  assertRejected("-nostdlib", "project.json compiler.flags cannot remove the hosted C environment");
  assertRejected("-march=native", "project.json compiler.flags cannot override the target environment");
  assertRejected("-includeconfig.h", "project.json compiler.flags cannot force source includes");
  assertRejected("-I", "project.json compiler flag '-I' must include its operand in the same argument");
  assertRejected("-xc++", "project.json compiler.flags cannot override input language");
});

function assertAllowed(flag: Str): void {
  const message = compilerFlagError(flag);
  if (message !== null) throw new Error(`Expected allowed flag '${flag}', got '${message}'`);
}

function assertRejected(flag: Str, expected: Str): void {
  const message = compilerFlagError(flag);
  if (message !== expected) throw new Error(`Expected '${expected}', got '${message}'`);
}
