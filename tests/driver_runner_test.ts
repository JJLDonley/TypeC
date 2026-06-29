import { executableNotFoundMessage, executableNotLaunchableMessage } from "driver/runner.ts";

type Str = string;

Deno.test("formats missing executable diagnostics", () => {
  assertText(executableNotFoundMessage("build/main"), "Executable not found: build/main");
});

Deno.test("formats unlaunchable executable diagnostics", () => {
  assertText(
    executableNotLaunchableMessage("build/main"),
    "Executable cannot be launched: build/main",
  );
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
