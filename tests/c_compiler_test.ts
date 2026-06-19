import { nativeCompileArgs } from "../src/c_compiler.ts";

type Str = string;

Deno.test("builds portable C compiler args", () => {
  assertEqualText(nativeCompileArgs({ cPath: "build/main.c", exePath: "build/main" }), [
    "-std=c99",
    "build/main.c",
    "-o",
    "build/main",
  ]);
});

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
