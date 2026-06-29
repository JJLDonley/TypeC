import {
  nativeCompileArgs,
  nativeCompilerCommand,
  nativeCompilerNotFoundMessage,
} from "c/compiler.ts";

type Str = string;

Deno.test("builds portable C compiler args", () => {
  assertEqualText(nativeCompileArgs({ cPath: "build/main.c", exePath: "build/main" }), [
    "-std=c11",
    "build/main.c",
    "-o",
    "build/main",
  ]);
});

Deno.test("selects native compiler command", () => {
  assertText(nativeCompilerCommand(), "cc");
});

Deno.test("formats missing native compiler diagnostics", () => {
  assertText(nativeCompilerNotFoundMessage("cc"), "Native C compiler not found: cc");
});

Deno.test("adds project compiler flags", () => {
  assertEqualText(
    nativeCompileArgs({ cPath: "build/main.c", exePath: "build/main", compilerFlags: ["-O2"] }),
    [
      "-std=c11",
      "build/main.c",
      "-o",
      "build/main",
      "-O2",
    ],
  );
});

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
