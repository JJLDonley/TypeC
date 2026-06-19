import { check } from "../src/checker.ts";
import { compileFile } from "../src/compiler.ts";
import { emitC } from "../src/emitter.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { resolve } from "../src/resolver.ts";

type Str = string;

Deno.test("tracks whether compiled source has main", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/lib.tc`, `export function add(a: i32, b: i32): i32 { return a + b; }`);
  await Deno.writeTextFile(`${dir}/main.tc`, `function main(): i32 { return 0; }`);
  const lib = await compileFile(`${dir}/lib.tc`, `${dir}/build`);
  const main = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  if (lib.hasMain) throw new Error("Expected library file without main");
  if (!main.hasMain) throw new Error("Expected main file with main");
});

Deno.test("emits C prototypes for extern functions", () => {
  const source = `extern function puts(s: u8*): i32; function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 puts(u8* s);");
  assertIncludes(c, "i32 main(void)");
});

Deno.test("emits extern prototypes before functions", () => {
  const source = `function main(): i32 { return add(20, 22); } extern function add(a: i32, b: i32): i32;`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertOrdered(c, "i32 add(i32 a, i32 b);", "i32 main(void)");
});

Deno.test("emits non-exported helpers with internal linkage", () => {
  const source = `function helper(): i32 { return 1; } export function api(): i32 { return helper(); } function main(): i32 { return api(); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "static i32 helper(void)");
  assertIncludes(c, "i32 api(void)");
  assertIncludes(c, "i32 main(void)");
});

Deno.test("emits prototypes for forward calls", () => {
  const source = `function main(): i32 { return helper(); } function helper(): i32 { return 42; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertOrdered(c, "static i32 helper(void);", "i32 main(void) {");
});

Deno.test("emits C for bare returns", () => {
  const source = `function done(): void { return; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return;");
});

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

Deno.test("emits C typedef for record aliases", () => {
  const source = `type Vec2 = { x: f32; y: f32; }; function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "typedef struct {");
  assertIncludes(c, "  f32 x;");
  assertIncludes(c, "  f32 y;");
  assertIncludes(c, "} Vec2;");
  assertOrdered(c, "  f32 x;", "  f32 y;");
});

Deno.test("emits C typedef for fixed array record fields", () => {
  const source = `type Block = { values: i32[3]; }; function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "  i32 values[3];");
});

Deno.test("emits C for record literals with array fields", () => {
  const source = `type Block = { values: i32[3]; }; function main(): i32 { const b: Block = { values: [1, 2, 3] }; return b.values[0]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Block b = (Block){ .values = { 1, 2, 3 } };");
});

Deno.test("emits C for record literals and field access", () => {
  const source = `type Vec2 = { x: f64; y: f64; }; function getX(v: Vec2): f64 { return v.x; } function main(): i32 { const v: Vec2 = { x: 1.5, y: 2.5 }; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return v.x;");
  assertIncludes(c, "const Vec2 v = (Vec2){ .x = 1.5, .y = 2.5 };");
});

Deno.test("emits C for nested record literals", () => {
  const source = `type Inner = { x: i32; }; type Outer = { inner: Inner; }; function main(): i32 { const o: Outer = { inner: { x: 42 } }; return o.inner.x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Outer o = (Outer){ .inner = (Inner){ .x = 42 } };");
});

Deno.test("emits C for functions returning records", () => {
  const source = `type Vec2 = { x: f64; y: f64; }; function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "Vec2 add(Vec2 a, Vec2 b)");
  assertIncludes(c, "return (Vec2){ .x = a.x + b.x, .y = a.y + b.y };");
});

Deno.test("emits C for nested record returns", () => {
  const source = `type Vec2 = { x: f64; y: f64; }; function choose(ok: bool): Vec2 { if (ok) { return { x: 1.0, y: 2.0 }; } return { x: 3.0, y: 4.0 }; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return (Vec2){ .x = 1.0, .y = 2.0 };");
  assertIncludes(c, "return (Vec2){ .x = 3.0, .y = 4.0 };");
});

Deno.test("emits C for inferred arrays and indexing", () => {
  const source = `function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[0]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const i32 xs[3] = { 1, 2, 3 };");
  assertIncludes(c, "return xs[0];");
});

Deno.test("emits C for fixed array parameters", () => {
  const source = `function first(values: i32[3]): i32 { return values[0]; } function main(): i32 { const xs: i32[] = [1, 2, 3]; return first(xs); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 first(i32 values[3])");
  assertIncludes(c, "return first(xs);");
});

Deno.test("emits C for while and assignment", () => {
  const source = `function main(): i32 { let x: i32 = 0; while (x < 3) { x = x + 1; } return x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "while (x < 3) {");
  assertIncludes(c, "x = x + 1;");
});

Deno.test("emits C for bool literals", () => {
  const source = `function flag(): bool { return true; } function main(): i32 { const ok: bool = false; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "b8 flag(void)");
  assertIncludes(c, "return true;");
  assertIncludes(c, "const b8 ok = false;");
});

Deno.test("emits C for if else statements", () => {
  const source = `function main(): i32 { if (true) { return 1; } else { return 0; } }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "if (true) {");
  assertIncludes(c, "} else {");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertOrdered(haystack: Str, first: Str, second: Str): void {
  if (haystack.indexOf(first) >= haystack.indexOf(second)) throw new Error(`Expected ${first} before ${second}`);
}
