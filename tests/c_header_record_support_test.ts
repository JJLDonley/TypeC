import type { CHeaderRecord } from "c/header/ast.ts";
import { supportedHeaderRecords } from "c/header/record_support.ts";

type Str = string;
type usize = number;

Deno.test("keeps supported header records", () => {
  const records = supportedHeaderRecords([
    record("Color", [["r", "unsigned char"]]),
    record("Paint", [["tint", "Color"]]),
  ]);

  assertSame(records.length, 2);
});

Deno.test("skips records depending on unsupported records", () => {
  const records = supportedHeaderRecords([
    record("Bad", [["x", "__unsupported_t"]]),
    record("Paint", [["bad", "Bad"]]),
  ]);

  assertSame(records.length, 0);
});

Deno.test("skips records with unsupported names fields or types", () => {
  const records = supportedHeaderRecords([
    record("bad-name", [["x", "int32_t"]]),
    record("BadField", [["bad-name", "int32_t"]]),
    record("BadType", [["x", "__unsupported_t"]]),
  ]);

  assertSame(records.length, 0);
});

function record(name: Str, fields: [Str, Str][]): CHeaderRecord {
  return {
    name,
    fields: fields.map(([fieldName, type]) => ({ name: fieldName, type })),
    sourceFile: null,
  };
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
