import { check } from "../src/checker.ts";
import { emitC } from "../src/emitter.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { resolve } from "../src/resolver.ts";

type Str = string;

Deno.test("emits C for minimal main", () => {
  const source = `function main(): i32 {\n  return 0;\n}\n`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "typedef int32_t i32;");
  assertIncludes(c, "i32 main(void)");
  assertIncludes(c, "return 0;");
});

Deno.test("emits C for const and function call", () => {
  const source = `function add(a: i32, b: i32): i32 { return a + b; }\nfunction main(): i32 { const x: i32 = add(20, 22); return x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 add(i32 a, i32 b)");
  assertIncludes(c, "const i32 x = add(20, 22);");
});

Deno.test("emits C for postfix pointer expressions", () => {
  const source = `function main(): i32 { let x: i32 = 1; const p: i32* = x.&; return p.*; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32* p = &x;");
  assertIncludes(c, "return *p;");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
