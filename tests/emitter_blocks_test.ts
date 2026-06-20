import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";

type Str = string;

Deno.test("emits braced blocks", () => {
  assertText(
    emitBracedBlock("while (true) {", ["return 1;"]),
    "while (true) {\n    return 1;\n  }",
  );
});

Deno.test("emits if else blocks", () => {
  assertText(
    emitIfElseBlock("if (flag) {", ["return 1;"], ["return 2;"]),
    "if (flag) {\n    return 1;\n  } else {\n    return 2;\n  }",
  );
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
