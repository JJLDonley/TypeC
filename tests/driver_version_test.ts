import { compilerVersion, versionText } from "driver/version.ts";

type Str = string;

Deno.test("prints compiler version text", () => {
  assertText(compilerVersion(), "0.1.2");
  assertText(versionText(), "TypeC 0.1.2");
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
