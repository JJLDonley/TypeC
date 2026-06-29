import { TypeCError } from "core/diagnostics.ts";
import { compileFile } from "driver/compiler.ts";
import { check } from "checker";
import { instantiateGenerics } from "core/generics.ts";
import { loadProgram } from "module/loader.ts";
import { resolve } from "core/resolver.ts";

type Str = string;

const stdExamples: Str[] = [
  "examples/std_result.tc",
  "examples/std_option.tc",
  "examples/std_slice.tc",
  "examples/std_mem.tc",
  "examples/std_c.tc",
  "examples/std_test.tc",
];

Deno.test("compiles standard library examples", async () => {
  for (const path of stdExamples) await compileExample(path);
});

Deno.test("rejects invalid std/result calls", async () => {
  await assertStdError(
    `import { result_ok_i32 } from "std/result.tc"; function main(): i32 { const r = result_ok_i32(true, 0); return 0; }`,
    "Argument 1 type 'bool' is not assignable to 'i32'",
  );
});

Deno.test("rejects invalid std/option calls", async () => {
  await assertStdError(
    `import { option_unwrap_or_i32 } from "std/option.tc"; function main(): i32 { return option_unwrap_or_i32(1, 0); }`,
    "Argument 1 type 'i32' is not assignable to 'OptionI32'",
  );
});

Deno.test("rejects invalid std/slice calls", async () => {
  await assertStdError(
    `import { slice_first_i32 } from "std/slice.tc"; function main(): i32 { return slice_first_i32(1); }`,
    "Argument 1 type 'i32' is not assignable to 'i32*'",
  );
});

Deno.test("rejects invalid std/mem calls", async () => {
  await assertStdError(
    `import { align_up_usize } from "std/mem.tc"; function main(): i32 { return align_up_usize(true, 8) as i32; }`,
    "Argument 1 type 'bool' is not assignable to 'usize'",
  );
});

Deno.test("rejects invalid std/c calls", async () => {
  await assertStdError(
    `import { c_int_zero } from "std/c.tc"; function main(): i32 { return c_int_zero(1) as i32; }`,
    "Function 'c_int_zero' expects 0 arguments, got 1",
  );
});

Deno.test("rejects invalid std/test calls", async () => {
  await assertStdError(
    `import { assert_true } from "std/test.tc"; function main(): i32 { return assert_true(1); }`,
    "Argument 1 type 'i32' is not assignable to 'bool'",
  );
});

async function compileExample(path: Str): Promise<void> {
  await compileFile(path, await Deno.makeTempDir());
}

async function assertStdError(source: Str, expected: Str): Promise<void> {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/main.tc`;
  await Deno.writeTextFile(path, source);
  try {
    check(resolve(instantiateGenerics(await loadProgram(path))));
  } catch (error) {
    if (!(error instanceof TypeCError)) throw error;
    const message = error.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
    if (!message.includes(expected)) throw new Error(`Expected '${expected}' in '${message}'`);
    return;
  }
  throw new Error("Expected stdlib program to fail");
}
