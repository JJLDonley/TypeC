import { decodedPathSegment, hasBackslash, hasEncodedDotSegment, hasEncodedSeparator, hasMalformedEncoding } from "../src/path_encoding.ts";

type Str = string;
type b8 = boolean;

Deno.test("detects encoded path hazards", () => {
  assertSame(hasBackslash("basic\\math"), true);
  assertSame(hasEncodedSeparator("basic%2fmath"), true);
  assertSame(hasEncodedSeparator("basic%5cmath"), true);
  assertSame(hasEncodedDotSegment("basic/%2e/math"), true);
  assertSame(hasEncodedDotSegment("basic/%2e%2e/math"), true);
  assertSame(hasMalformedEncoding("basic%zzmath"), true);
});

Deno.test("decodes path segments", () => {
  assertText(decodedPathSegment("basic%20math") ?? "", "basic math");
  assertSame(decodedPathSegment("basic%zzmath") === null, true);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
