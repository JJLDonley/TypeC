import { TypeCError } from "core/diagnostics.ts";
import {
  isFalseJsonFlag,
  isJsonArray,
  isJsonText,
  isNonEmptyJsonText,
  isTruthyJsonFlag,
  readJsonText,
} from "json/values.ts";

type Str = string;
type b8 = boolean;

Deno.test("classifies JSON primitive values", () => {
  assertSame(isJsonText("typec"), true);
  assertSame(isJsonText(1n), false);
  assertSame(isNonEmptyJsonText("typec"), true);
  assertSame(isNonEmptyJsonText(""), false);
  assertSame(isJsonArray([]), true);
  assertSame(isJsonArray({}), false);
  assertSame(isTruthyJsonFlag(true), true);
  assertSame(isTruthyJsonFlag(false), false);
  assertSame(isFalseJsonFlag(false), true);
  assertSame(isFalseJsonFlag(true), false);
});

Deno.test("reads JSON text", () => {
  assertText(readJsonText("typec", "expected text"), "typec");
  assertJsonValueError(() => readJsonText(1n, "expected text"), "expected text", "E3100");
});

function assertJsonValueError(run: () => void, message: Str, code: Str): void {
  try {
    run();
  } catch (error) {
    const diagnostic = error instanceof TypeCError ? error.diagnostics[0] : undefined;
    if (diagnostic?.message === message && diagnostic.code === code) return;
    throw error;
  }
  throw new Error(`Expected ${message}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
