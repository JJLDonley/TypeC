import { check } from "../src/checker.ts";
import { TypeCError } from "../src/diagnostics.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { resolve } from "../src/resolver.ts";

type Str = string;

Deno.test("records typed expression information", () => {
  const program = check(resolve(parse(lex(`function main(): i32 { return 0; }`))));
  const types = [...program.expressionTypes.values()].map((entry) => entry.type);
  assertIncludes(types, "i32");
});

Deno.test("checks postfix address assigned to pointer", () => {
  check(resolve(parse(lex(`function main(): i32 { const x: i32 = 1; const p: i32* = x.&; return p.*; }`))));
});

Deno.test("checks postfix address assigned to reference", () => {
  check(resolve(parse(lex(`function main(): i32 { const x: i32 = 1; const r: i32& = x.&; return r.*; }`))));
});

Deno.test("rejects invalid dereference", () => {
  assertCheckError(`function main(): i32 { const x: i32 = 1; return x.*; }`, "Cannot dereference non-pointer-like type 'i32'");
});

Deno.test("rejects return mismatch", () => {
  assertCheckError(`function main(): i32 { return 1.5; }`, "Return type 'f64' is not assignable to 'i32'");
});

function assertCheckError(source: Str, message: Str): void {
  try {
    check(resolve(parse(lex(source))));
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected checker error: ${message}`);
}

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
}
