import type { CHeaderRecord } from "c/header/ast.ts";
import { orderHeaderRecordsByDependencies } from "c/header/record_order.ts";

type Str = string;

Deno.test("orders header records before dependent fields", () => {
  const records = orderHeaderRecordsByDependencies([
    record("Paint", [["tint", "Color"]]),
    record("Color", [["r", "unsigned char"]]),
  ]);

  assertText(records[0]?.name ?? "", "Color");
  assertText(records[1]?.name ?? "", "Paint");
});

Deno.test("orders header records through pointer and array fields", () => {
  const records = orderHeaderRecordsByDependencies([
    record("Palette", [["colors", "Color[4]"]]),
    record("Brush", [["paint", "struct Paint *"]]),
    record("Paint", [["tint", "Color"]]),
    record("Color", [["r", "unsigned char"]]),
  ]);

  assertText(records.map((record) => record.name).join(","), "Color,Palette,Paint,Brush");
});

Deno.test("drops unresolved record cycles after ordered records", () => {
  const records = orderHeaderRecordsByDependencies([
    record("A", [["b", "B"]]),
    record("B", [["a", "A"]]),
    record("Color", [["r", "unsigned char"]]),
  ]);

  assertText(records.map((record) => record.name).join(","), "Color");
});

Deno.test("drops self-referential records", () => {
  const records = orderHeaderRecordsByDependencies([
    record("Node", [["next", "Node*"]]),
    record("Color", [["r", "unsigned char"]]),
  ]);

  assertText(records.map((record) => record.name).join(","), "Color");
});

function record(name: Str, fields: [Str, Str][]): CHeaderRecord {
  return {
    name,
    fields: fields.map(([fieldName, type]) => ({ name: fieldName, type })),
    sourceFile: null,
  };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
