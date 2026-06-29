import { mapCHeaderRecordFieldType } from "c/header/record_field_types.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

Deno.test("maps C record field types", () => {
  const records = new Set<Str>(["Color"]);

  assertSame(mapCHeaderRecordFieldType("int32_t", records), "i32");
  assertSame(mapCHeaderRecordFieldType("Color[4]", records), "Color[4]");
  assertSame(mapCHeaderRecordFieldType("const Color [ 4 ]", records), "Color[4]");
});

Deno.test("maps nested C record array fields", () => {
  assertSame(
    mapCHeaderRecordFieldType("int32_t[2][3]", new Set<Str>()),
    "Array<Array<i32, 3>, 2>",
  );
});

Deno.test("rejects unsized nested C record array fields", () => {
  try {
    mapCHeaderRecordFieldType("int32_t[][3]", new Set<Str>());
  } catch (error) {
    if (isCHeaderRecordArrayError(error)) return;
  }
  throw new Error("Expected unsupported record array error");
});

Deno.test("rejects unsized C record array fields", () => {
  try {
    mapCHeaderRecordFieldType("int32_t[]", new Set<Str>());
  } catch (error) {
    if (isCHeaderRecordArrayError(error)) return;
  }
  throw new Error("Expected unsupported record array error");
});

Deno.test("rejects static C record array fields", () => {
  try {
    mapCHeaderRecordFieldType("int32_t[static 4]", new Set<Str>());
  } catch (error) {
    if (isCHeaderRecordArrayError(error)) return;
  }
  throw new Error("Expected unsupported record array error");
});

function isCHeaderRecordArrayError(error: unknown): b8 {
  return error instanceof TypeCError && error.diagnostics[0]?.code === "E2807";
}

function assertSame(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
