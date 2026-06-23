import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { exportAllFunctions, mergeProgram, selectImports } from "module/programs.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("exports all header functions", () => {
  const program = parse(lex(`extern function add(left: i32, right: i32): i32;`));
  const exported = exportAllFunctions(program);
  assertSame(exported.functions[0]?.exported ?? false, true);
});

Deno.test("merges imported programs before local declarations", () => {
  const imported = parse(lex(`export function add(): i32 { return 1; }`));
  const local = parse(lex(`function main(): i32 { return 0; }`));
  const merged = mergeProgram(local, [imported]);

  assertSame(merged.imports.length, 0);
  assertSame(merged.functions.length, 2);
  assertText(merged.functions[0]?.name ?? "", "add");
  assertText(merged.functions[1]?.name ?? "", "main");
});

Deno.test("selects exported imports", () => {
  const program = parse(lex(`
    export type Point = { x: i32; y: i32; };
    export function origin(): Point { return { x: 0, y: 0 }; }
    function hidden(): i32 { return 1; }
  `));
  const selected = selectImports(program, ["Point", "origin"], program.span);

  assertSame(selected.typeAliases.length, 1);
  assertSame(selected.functions.length, 1);
  assertText(selected.typeAliases[0]?.name ?? "", "Point");
  assertText(selected.functions[0]?.name ?? "", "origin");
});

Deno.test("rejects missing exports", () => {
  const program = parse(lex(`function hidden(): i32 { return 1; }`));
  assertModuleError(
    () => selectImports(program, ["hidden"], program.span),
    "Module does not export 'hidden'",
  );
});

function assertModuleError(run: () => void, message: Str): void {
  try {
    run();
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics[0]?.message === message) return;
    throw error;
  }
  throw new Error(`Expected ${message}`);
}

function assertSame(actual: usize | b8, expected: usize | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
