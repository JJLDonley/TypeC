import { mapCHeaderRecordFieldType } from "c/header/record_field_types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;

Deno.test("maps C record field types", () => {
  const records = new Set<Str>(["Color"]);

  assertSame(mapCHeaderRecordFieldType("int32_t", records), "i32");
  assertSame(mapCHeaderRecordFieldType("Color[4]", records), "Color[4]");
});

Deno.test("rejects unsized C record array fields", () => {
  try {
    mapCHeaderRecordFieldType("int32_t[]", new Set<Str>());
  } catch (error) {
    if (error instanceof TypeCError) return;
  }
  throw new Error("Expected unsupported record array error");
});

Deno.test("rejects static C record array fields", () => {
  try {
    mapCHeaderRecordFieldType("int32_t[static 4]", new Set<Str>());
  } catch (error) {
    if (error instanceof TypeCError) return;
  }
  throw new Error("Expected unsupported record array error");
});

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
