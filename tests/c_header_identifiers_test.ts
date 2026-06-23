import {
  isTypeCIdentifier,
  sanitizeHeaderParamName,
  uniqueHeaderParamName,
} from "c/header/identifiers.ts";

type Str = string;
type b8 = boolean;

Deno.test("classifies TypeC identifiers for generated headers", () => {
  assertSame(isTypeCIdentifier("add_i32"), true);
  assertSame(isTypeCIdentifier("1bad"), false);
  assertSame(isTypeCIdentifier("export"), false);
  assertSame(isTypeCIdentifier("i32"), false);
});

Deno.test("sanitizes header parameter names", () => {
  assertText(sanitizeHeaderParamName("left"), "left");
  assertText(sanitizeHeaderParamName("1value"), "arg_1value");
  assertText(sanitizeHeaderParamName("arg-name"), "arg_name");
  assertText(sanitizeHeaderParamName("function"), "arg_function");
});

Deno.test("deduplicates header parameter names", () => {
  const names = new Set<Str>();
  assertText(uniqueHeaderParamName("value", names), "value");
  assertText(uniqueHeaderParamName("value", names), "value_1");
  assertText(uniqueHeaderParamName("value", names), "value_2");
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
