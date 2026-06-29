import { printAst } from "core/ast_printer.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { formatTypeCSource } from "formatter";
import { readFormatTokens } from "formatter/tokens.ts";

type Str = string;
type b8 = boolean;
type usize = number;

const grammarSamples: Str[] = [
  `import { add as sum } from "./math.tc"; export const LIMIT: i32 = 4; function main(): i32 { return sum(LIMIT, 1); }`,
  `type Pair = { readonly left: i32; right?: i32; }; struct Point { x: i32; y: i32; } enum Color: i32 { Red = 1, Blue = 2 }`,
  `interface Readable { read(): i32; } class Box { value: i32; constructor(value: i32) { this.value = value; } get(): i32 { return this.value; } }`,
  `union MaybeI32 { Some: i32; None; } function read(value: MaybeI32): i32 { switch (value.tag) { case MaybeI32.Some: return value.Some; default: return 0; } }`,
  `type Holder<T extends { id: i32; }> = { value: T; }; function id<T>(value: T): T { return value; }`,
  `function flow(value: i32): i32 { let total: i32 = 0; for (let i: i32 = 0; i < value; i++) { if (i == 2) { continue; } total += i; } while (total > 10) { break; } return total; }`,
  `function aggregates(): i32 { const a: i32[3] = [1, 2, 3]; const t: [i32, bool] = [a[0], true]; const p: { x: i32; y: i32; } = { x: t[0], y: 2 }; return p.x + p.y; }`,
  `function pointers(value: i32): i32 { const p: i32* = value.&; const r: i32& = value.&; const s: SafePtr<i32> = value.&; return p.* + r.* + s.*; }`,
  `function optionals(value: i32?): i32 { const result: i32 = value ?? 7; return value! + result; }`,
  `function calls(callback: (value: i32) => i32): i32 { return callback(1) + ((2 + 3) * 4); }`,
  `function arrays(): i32 { const values: i32[3] = Array.fill((index) => index as i32); const view: Slice<i32> = values.slice(0, 2); return view.length() as i32; }`,
  `function loops(values: i32[2]): i32 { let total: i32 = 0; for (const value of values) { total += value; } for (const key in { a: 1, b: 2 }) { total += key.length(); } return total; }`,
];

Deno.test("formatter output parses to equivalent AST for 0.1 grammar samples", () => {
  for (const source of grammarSamples) assertEquivalentAst(source, formatTypeCSource(source));
});

Deno.test("formatter is idempotent for 0.1 grammar samples", () => {
  for (const source of grammarSamples) {
    assertText(formatTypeCSource(formatTypeCSource(source)), formatTypeCSource(source));
  }
});

Deno.test("formatter preserves token text and comments", () => {
  const source = `// leading\nfunction main(): i32 { /* inner */ return 0; } // trailing`;
  const formatted = formatTypeCSource(source);

  assertTextList(tokenTexts(formatted), tokenTexts(source));
  assertSame(commentCount(formatted), 3);
});

Deno.test("formatter is idempotent for examples and stdlib", async () => {
  const paths = await sourcePaths(["examples", "std"]);
  for (const path of paths) {
    const formatted = formatTypeCSource(await Deno.readTextFile(path));
    assertText(formatTypeCSource(formatted), formatted);
  }
});

function assertEquivalentAst(source: Str, formatted: Str): void {
  assertText(astText(formatted), astText(source));
}

function astText(source: Str): Str {
  return printAst(parse(lex(source)));
}

function tokenTexts(source: Str): Str[] {
  return readFormatTokens(source).map((token) => token.text);
}

function commentCount(source: Str): usize {
  return readFormatTokens(source).filter((token) => token.kind === "comment").length;
}

async function sourcePaths(roots: Str[]): Promise<Str[]> {
  const paths: Str[] = [];
  for (const root of roots) await collectSourcePaths(root, paths);
  return paths;
}

async function collectSourcePaths(root: Str, paths: Str[]): Promise<void> {
  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      await collectSourcePaths(path, paths);
      continue;
    }
    if (entry.isFile && path.endsWith(".tc")) paths.push(path);
  }
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected:\n${expected}\nActual:\n${actual}`);
}

function assertTextList(actual: Str[], expected: Str[]): void {
  if (actual.length !== expected.length) {
    throw new Error(`Expected ${expected.length} tokens, got ${actual.length}`);
  }
  for (let index: usize = 0; index < expected.length; index += 1) {
    assertText(actual[index] ?? "", expected[index] ?? "");
  }
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
