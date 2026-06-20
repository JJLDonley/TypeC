import { typeUsesKnownRecord } from "c/header/record_type_usage.ts";

type b8 = boolean;

Deno.test("detects known record type spellings", () => {
  const records = new Set(["Color"]);

  assertSame(typeUsesKnownRecord("Color", records), true);
  assertSame(typeUsesKnownRecord("struct Color", records), true);
  assertSame(typeUsesKnownRecord("const Color *", records), true);
  assertSame(typeUsesKnownRecord("struct Color * _Nullable", records), true);
  assertSame(typeUsesKnownRecord("Color[4]", records), true);
  assertSame(typeUsesKnownRecord("int32_t", records), false);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
