import {
  cArrayType,
  formatHeaderEnums,
  mapScalarCHeaderType,
  normalizeCHeaderType,
  stripHeaderTrailingComment,
} from "c/header";

type Str = string;

Deno.test("exports C header public helpers", () => {
  assertText(mapScalarCHeaderType("int32_t") ?? "", "i32");
  assertText(normalizeCHeaderType("const Color [ 4 ]"), "Color[4]");
  assertText(cArrayType("Color[4]")?.element ?? "", "Color");
  assertText(stripHeaderTrailingComment(" 42 // value"), " 42");
  assertText(
    formatHeaderEnums([{ name: "Mode", members: [{ name: "On", value: "1" }], sourceFile: null }]),
    "export enum Mode {\n  On = 1,\n}\n",
  );
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
