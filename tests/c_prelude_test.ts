import { emitCPrelude } from "../src/c_prelude.ts";

type Str = string;

Deno.test("emits required C prelude", () => {
  const prelude = emitCPrelude().join("\n");
  assertIncludes(prelude, "#include <stdint.h>");
  assertIncludes(prelude, "#include <stdbool.h>");
  assertIncludes(prelude, "#include <stddef.h>");
  assertIncludes(prelude, "typedef int32_t i32;");
  assertIncludes(prelude, "typedef size_t usize;");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
