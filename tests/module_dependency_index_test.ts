import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { createDependencySet, filterProgramDependencies, indexProgramDependencies } from "module/dependency_index.ts";

type Str = string;
type usize = number;
type b8 = boolean;

Deno.test("indexes program dependencies", () => {
  const program = parse(lex(`type Point = { x: i32; }; function main(): i32 { return 0; }`));
  const index = indexProgramDependencies(program);

  assertSame(index.types.has("Point"), true);
  assertSame(index.functions.has("main"), true);
});

Deno.test("creates dependency sets", () => {
  const selected = createDependencySet(["Point"], ["main"]);

  assertSame(selected.types.has("Point"), true);
  assertSame(selected.functions.has("main"), true);
});

Deno.test("filters program dependencies", () => {
  const program = parse(lex(`
    type Point = { x: i32; };
    type Hidden = { x: i32; };
    function main(): i32 { return 0; }
    function hidden(): i32 { return 1; }
  `));
  const selected = createDependencySet(["Point"], ["main"]);
  const filtered = filterProgramDependencies(program, selected);

  assertSame(filtered.imports.length, 0);
  assertSame(filtered.typeAliases.length, 1);
  assertText(filtered.typeAliases[0]?.name ?? "", "Point");
  assertSame(filtered.functions.length, 1);
  assertText(filtered.functions[0]?.name ?? "", "main");
});

function assertSame(actual: usize | b8, expected: usize | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
