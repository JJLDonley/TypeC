import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { resolve } from "core/resolver.ts";

type Str = string;
type u32 = number;

Deno.test("resolves symbols and scopes", () => {
  const program = resolve(parse(lex(`function main(): i32 { const x: i32 = 1; return x; }`)));
  assertIncludes(program.symbols.map((symbol) => symbol.name), "main");
  assertIncludes(program.symbols.map((symbol) => symbol.name), "x");
  assertEquals(program.scopes.length, 2);
});

Deno.test("rejects duplicate functions", () => {
  assertResolveError(
    `function main(): i32 { return 0; } function main(): i32 { return 1; }`,
    "Duplicate function 'main'",
  );
});

Deno.test("rejects duplicate type aliases", () => {
  assertResolveError(
    `type Vec2 = { x: f32; }; type Vec2 = { y: f32; }; function main(): i32 { return 0; }`,
    "Duplicate type 'Vec2'",
  );
});

Deno.test("rejects duplicate parameters", () => {
  assertResolveError(`function add(a: i32, a: i32): i32 { return a; }`, "Duplicate parameter 'a'");
});

Deno.test("rejects duplicate locals", () => {
  assertResolveError(
    `function main(): i32 { const x: i32 = 1; const x: i32 = 2; return x; }`,
    "Duplicate local 'x'",
  );
});

Deno.test("rejects unknown identifiers", () => {
  assertResolveError(`function main(): i32 { return x; }`, "Unknown identifier 'x'");
});

Deno.test("allows block-local shadowing", () => {
  resolve(parse(lex(`function main(): i32 { const x: i32 = 1; if (true) { const x: i32 = 2; } else { const x: i32 = 3; } return x; }`)));
});

Deno.test("rejects use of block locals outside block", () => {
  assertResolveError(`function main(): i32 { if (true) { const x: i32 = 1; } return x; }`, "Unknown identifier 'x'");
  assertResolveError(`function main(): i32 { while (true) { const x: i32 = 1; } return x; }`, "Unknown identifier 'x'");
});

Deno.test("rejects unknown functions", () => {
  assertResolveError(`function main(): i32 { return missing(); }`, "Unknown identifier 'missing'");
});

function assertResolveError(source: Str, message: Str): void {
  try {
    resolve(parse(lex(source)));
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected resolver error: ${message}`);
}

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
}

function assertEquals(actual: u32, expected: u32): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
