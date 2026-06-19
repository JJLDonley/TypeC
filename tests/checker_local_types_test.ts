import { localDeclaredType } from "checker/local_types.ts";
import type { TypeName } from "core/tast.ts";

type Str = string;

Deno.test("keeps declared scalar and pointer local types", () => {
  assertType(localDeclaredType("void*", "u8[4]"), "void*");
  assertType(localDeclaredType("i32", "i32"), "i32");
});

Deno.test("stores inferred array local lengths", () => {
  assertType(localDeclaredType("u8[]", "u8[4]"), "u8[4]");
});

function assertType(actual: TypeName, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
