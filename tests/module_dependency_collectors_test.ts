import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { collectFunctionDeps, collectTypeAliasDeps } from "module/dependency_collectors.ts";
import { createDependencySet } from "module/dependency_index.ts";

type b8 = boolean;

Deno.test("collects type alias dependencies", () => {
  const program = parse(lex(`type Point = { x: Scalar; }; type Scalar = i32;`));
  const selected = createDependencySet([], []);

  collectTypeAliasDeps(program.typeAliases[0], selected);

  assertSame(selected.types.has("Scalar"), true);
});

Deno.test("collects function dependencies", () => {
  const program = parse(lex(`
    type Point = { x: i32; };
    function make(): Point { return { x: 1 }; }
    function main(): i32 {
      const p: Point = make();
      if (true) { return p.x; } else { return 0; }
    }
  `));
  const selected = createDependencySet([], []);

  collectFunctionDeps(program.functions[1], selected);

  assertSame(selected.types.has("Point"), true);
  assertSame(selected.functions.has("make"), true);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
