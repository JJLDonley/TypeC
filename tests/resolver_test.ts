import { TypeCError } from "../src/diagnostics.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { resolve } from "../src/resolver.ts";

type Str = string;

Deno.test("resolves symbols", () => {
  const program = resolve(parse(lex(`function main(): i32 { const x: i32 = 1; return x; }`)));
  assertIncludes(program.symbols.map((symbol) => symbol.name), "main");
  assertIncludes(program.symbols.map((symbol) => symbol.name), "x");
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
