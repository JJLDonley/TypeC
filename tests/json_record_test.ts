import { isJsonRecord } from "../src/json_record.ts";

type b8 = boolean;

Deno.test("classifies JSON records", () => {
  assertSame(isJsonRecord({}), true);
  assertSame(isJsonRecord({ key: "value" }), true);
  assertSame(isJsonRecord([]), false);
  assertSame(isJsonRecord(null), false);
  assertSame(isJsonRecord("text"), false);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
