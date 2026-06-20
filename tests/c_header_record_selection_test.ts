import type { CHeaderRecord } from "c/header/ast.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";

type Str = string;
type usize = number;

Deno.test("selects compatible records inside include directory", () => {
  const records = selectHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/include/a.h"),
    record("Color", [["r", "uint8_t"]], "/project/include/b.h"),
  ], "/project/include");

  assertSame(records.length, 1);
});

Deno.test("ignores incompatible records outside include directory", () => {
  const records = selectHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/include/color.h"),
    record("Color", [["r", "int32_t"]], "/usr/include/color.h"),
  ], "/project/include");

  assertSame(records.length, 1);
  assertText(records[0]?.sourceFile ?? "", "/project/include/color.h");
});

Deno.test("drops incompatible records inside include directory", () => {
  const records = selectHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/include/a.h"),
    record("Color", [["r", "int32_t"]], "/project/include/b.h"),
  ], "/project/include");

  assertSame(records.length, 0);
});

function record(name: Str, fields: [Str, Str][], sourceFile: Str): CHeaderRecord {
  return {
    name,
    fields: fields.map(([fieldName, type]) => ({ name: fieldName, type })),
    sourceFile,
  };
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
