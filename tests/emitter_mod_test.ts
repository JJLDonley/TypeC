import { emitBracedBlock, emitC } from "emitter";

type Str = string;

Deno.test("exports emitter public helpers", () => {
  assertText(typeof emitC, "function");
  assertText(
    emitBracedBlock("while (true) {", ["return;"], "}"),
    "while (true) {\n    return;\n  }",
  );
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
