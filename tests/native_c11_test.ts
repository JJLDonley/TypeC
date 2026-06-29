import { check } from "checker";
import { emitC } from "emitter";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { resolve } from "core/resolver.ts";

type Str = string;
type b8 = boolean;

Deno.test("emitted arena C compiles as C11", async () => {
  if (!await hasNativeCompiler()) return;
  const c = emitC(check(resolve(parse(lex(`
    function main(): i32 {
      const arena: Arena = arenaCreate();
      const value: SafePtr<i32> = arenaAlloc(arena, 1);
      const result: i32 = value.*;
      arenaDestroy(arena);
      return result;
    }
  `)))));

  await assertCompilesAsC11(c);
});

Deno.test("emitted representative C compiles as C11", async () => {
  if (!await hasNativeCompiler()) return;
  const c = emitC(check(resolve(parse(lex(`
    type Pair = { x: i32; y: i32; };
    enum Color { Red, Green }
    union MaybeI32 { Some: i32; None; }
    function inc(value: i32): i32 { return value + 1; }
    function apply(callback: (value: i32) => i32, value: i32): i32 {
      return callback(value);
    }
    function main(): i32 {
      const pair: Pair = { x: 1, y: 2 };
      const tuple: [i32, i32] = [pair.x, pair.y];
      const maybe: MaybeI32 = MaybeI32.Some(tuple[0]);
      switch (maybe.tag) {
        case MaybeI32.Some:
          return apply(inc, maybe.Some);
        default:
          return 0;
      }
    }
  `)))));

  await assertCompilesAsC11(c);
});

async function hasNativeCompiler(): Promise<b8> {
  try {
    const output = await new Deno.Command("cc", { args: ["--version"] }).output();
    return output.success;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

async function assertCompilesAsC11(c: Str): Promise<void> {
  const dir = await Deno.makeTempDir();
  const cPath = `${dir}/main.c`;
  const objectPath = `${dir}/main.o`;
  await Deno.writeTextFile(cPath, c);
  const output = await new Deno.Command("cc", {
    args: ["-std=c11", "-Wall", "-Wextra", "-pedantic", "-c", cPath, "-o", objectPath],
  }).output();
  if (output.success) return;
  const stderr = new TextDecoder().decode(output.stderr);
  throw new Error(stderr);
}
