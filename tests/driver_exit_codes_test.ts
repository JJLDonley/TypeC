import { EXIT_FAILURE, EXIT_SUCCESS } from "driver/exit_codes.ts";

type i32 = number;

Deno.test("documents stable driver exit codes", () => {
  assertSame(EXIT_SUCCESS, 0);
  assertSame(EXIT_FAILURE, 1);
});

function assertSame(actual: i32, expected: i32): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
