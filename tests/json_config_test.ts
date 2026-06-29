import { TypeCError } from "core/diagnostics.ts";
import { parseJsonRecord, rejectUnknownJsonKeys } from "json/config.ts";

type Str = string;
type usize = number;

Deno.test("parses JSON records", () => {
  const record = parseJsonRecord(`{"name":"typec"}`, "invalid json", "not object");

  assertSame(Object.keys(record).length, 1);
});

Deno.test("rejects invalid JSON records", () => {
  assertConfigError(
    () => parseJsonRecord(`{`, "invalid json", "not object"),
    "invalid json",
    "E2900",
  );
  assertConfigError(
    () => parseJsonRecord(`[]`, "invalid json", "not object"),
    "not object",
    "E2901",
  );
});

Deno.test("rejects unknown JSON keys", () => {
  assertConfigError(
    () => rejectUnknownJsonKeys("project.json", { extra: true }, ["dependencies"]),
    "project.json has unknown key 'extra'",
    "E2902",
  );
});

function assertConfigError(run: () => void, message: Str, code: Str): void {
  try {
    run();
  } catch (error) {
    if (
      error instanceof TypeCError && error.diagnostics[0]?.message === message &&
      error.diagnostics[0]?.code === code
    ) return;
    throw error;
  }
  throw new Error(`Expected ${message}`);
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
