import type { CHeaderRecord } from "c/header/ast.ts";
import { uniqueCompatibleHeaderRecords } from "c/header/record_uniqueness.ts";

type Str = string;
type usize = number;

Deno.test("keeps one compatible duplicate header record", () => {
  const records = uniqueCompatibleHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/a.h"),
    record("Color", [["r", "unsigned char"]], "/project/b.h"),
  ]);

  assertSame(records.length, 1);
  assertText(records[0]?.sourceFile ?? "", "/project/a.h");
});

Deno.test("keeps duplicate header records with equivalent TypeC field types", () => {
  const records = uniqueCompatibleHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/a.h"),
    record("Color", [["r", "uint8_t"]], "/project/b.h"),
  ]);

  assertSame(records.length, 1);
});

Deno.test("keeps duplicate header records with equivalent record field types", () => {
  const records = uniqueCompatibleHeaderRecords([
    record("Paint", [["color", "Color"]], "/project/a.h"),
    record("Paint", [["color", "struct Color"]], "/project/b.h"),
    record("Color", [["r", "unsigned char"]], "/project/color.h"),
  ]);

  assertSame(records.length, 2);
});

Deno.test("drops incompatible duplicate header records", () => {
  const records = uniqueCompatibleHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/a.h"),
    record("Color", [["r", "int32_t"]], "/project/b.h"),
  ]);

  assertSame(records.length, 0);
});

Deno.test("keeps distinct header records", () => {
  const records = uniqueCompatibleHeaderRecords([
    record("Color", [["r", "unsigned char"]], "/project/color.h"),
    record("Vec2", [["x", "float"]], "/project/vec.h"),
  ]);

  assertSame(records.length, 2);
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
