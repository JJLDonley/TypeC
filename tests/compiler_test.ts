import { check } from "checker";
import { compileFile } from "driver/compiler.ts";
import { emitC } from "emitter";
import { loadProgram } from "module/loader.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { resolve } from "core/resolver.ts";

type Str = string;
type usize = number;

Deno.test("tracks whether compiled source has main", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.tc`,
    `export function add(a: i32, b: i32): i32 { return a + b; }`,
  );
  await Deno.writeTextFile(`${dir}/main.tc`, `function main(): i32 { return 0; }`);
  const lib = await compileFile(`${dir}/lib.tc`, `${dir}/build`);
  const main = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  if (lib.hasMain) throw new Error("Expected library file without main");
  if (!main.hasMain) throw new Error("Expected main file with main");
});

Deno.test("tracks project compiler flags", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/project.json`, `{"compiler":{"flags":["-O2","-Wall"]}}`);
  await Deno.writeTextFile(`${dir}/main.tc`, `function main(): i32 { return 0; }`);
  const result = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  assertEqualText(result.compilerFlags, ["-O2", "-Wall"]);
});

Deno.test("emits C for namespace function dependencies", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/math.tc`,
    `function inc(x: i32): i32 { return x + 1; } export function answer(): i32 { return inc(41); }`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Math from "./math.tc"; function main(): i32 { return Math.answer(); }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static i32 Math_inc(i32 x)");
  assertIncludes(c, "return Math_inc(41);");
  assertIncludes(c, "return Math_answer();");
  assertNotIncludes(c, "Math.");
});

Deno.test("emits distinct C names for repeated namespace imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/left.tc`,
    `export function add(a: i32, b: i32): i32 { return a + b; }`,
  );
  await Deno.writeTextFile(
    `${dir}/right.tc`,
    `export function add(a: i32, b: i32): i32 { return a + b; }`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Left from "./left.tc"; import * as Right from "./right.tc"; function main(): i32 { return Left.add(20, Right.add(10, 12)); }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static i32 Left_add(i32 a, i32 b)");
  assertIncludes(c, "static i32 Right_add(i32 a, i32 b)");
  assertIncludes(c, "return Left_add(20, Right_add(10, 12));");
});

Deno.test("emits C for namespace type aliases with fixed array fields", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/types.tc`,
    `export type Bytes = { values: u8[4]; };`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Types from "./types.tc"; function main(): i32 { const bytes: Types.Bytes = { values: [1, 2, 3, 4] }; return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "u8 values[4];");
  assertIncludes(c, ".values = { 1, 2, 3, 4 }");
  assertNotIncludes(c, "Types.Bytes");
});

Deno.test("emits C for namespace type aliases", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/types.tc`, `export type Pair = { left: i32; right: i32; };`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Types from "./types.tc"; function main(): i32 { const p: Types.Pair = { left: 1, right: 2 }; return p.left; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "} Types_Pair;");
  assertIncludes(c, "const Types_Pair p = (Types_Pair){ .left = 1, .right = 2 };");
  assertNotIncludes(c, "Types.Pair");
});

Deno.test("emits C calls for namespace header imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/lib.h`, `void tick(void);`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { Lib.tick(); return 0; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "void tick(void);");
  assertIncludes(c, "tick();");
  assertNotIncludes(c, "Lib.tick");
});

Deno.test("deduplicates direct and namespace header function imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/lib.h`, `void tick(void);`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { tick } from "./lib.h"; import * as Lib from "./lib.h"; function main(): i32 { tick(); Lib.tick(); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertCount(c, "void tick(void);", 1);
  assertCount(c, "tick();", 2);
  assertNotIncludes(c, "Lib.tick");
});

Deno.test("deduplicates direct and namespace header record imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `typedef struct Color { unsigned char r; unsigned char g; unsigned char b; unsigned char a; } Color;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Color } from "./lib.h"; import * as Lib from "./lib.h"; function main(): i32 { const a: Color = { r: 1, g: 2, b: 3, a: 4 }; const b: Lib.Color = { r: 1, g: 2, b: 3, a: 4 }; return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertCount(c, "} Color;", 1);
  assertNotIncludes(c, "Lib.Color");
});

Deno.test("emits C for bare struct header records", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `struct Color { unsigned char r; }; void draw(struct Color c);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Color, draw } from "./lib.h"; function main(): i32 { const c: Color = { r: 1 }; draw(c); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "typedef struct Color {");
  assertIncludes(c, "void draw(Color c);");
});

Deno.test("emits C for namespace header record fixed array fields", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `typedef struct Pixel { unsigned char rgba[4]; } Pixel;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { const p: Lib.Pixel = { rgba: [1, 2, 3, 4] }; return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "u8 rgba[4];");
  assertIncludes(c, ".rgba = { 1, 2, 3, 4 }");
});

Deno.test("emits C for header bool record fields and functions", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdbool.h>\ntypedef struct Flag { bool enabled; } Flag;\nbool is_enabled(Flag flag);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Flag, is_enabled } from "./lib.h"; function main(): i32 { const flag: Flag = { enabled: true }; if (is_enabled(flag)) { return 42; } return 0; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "b8 enabled;");
  assertIncludes(c, "b8 is_enabled(Flag flag);");
  assertIncludes(c, ".enabled = true");
});

Deno.test("emits C for header function pointer parameters", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdint.h>\nvoid set_callback(int32_t (*callback)(int32_t));`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { set_callback } from "./lib.h"; function handler(value: i32): i32 { return value; } function main(): i32 { set_callback(handler); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "void set_callback(i32 (*callback)(i32));");
  assertIncludes(c, "set_callback(handler);");
});

Deno.test("emits C for header nested fixed array parameters", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdint.h>\nvoid consume(int32_t cells[2][3]);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { consume } from "./lib.h"; function main(): i32 { const cells: Array<Array<i32, 3>, 2> = [[1, 2, 3], [4, 5, 6]]; consume(cells); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "void consume(i32 (*cells)[3]);");
  assertIncludes(c, "i32 cells[2][3] = { { 1, 2, 3 }, { 4, 5, 6 } };");
  assertIncludes(c, "consume(cells);");
});

Deno.test("emits C for header record nested fixed array fields", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdint.h>\ntypedef struct Matrix { int32_t cells[2][3]; } Matrix;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Matrix } from "./lib.h"; function main(): i32 { const m: Matrix = { cells: [[1, 2, 3], [4, 5, 6]] }; return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "i32 cells[2][3];");
  assertIncludes(c, ".cells = { { 1, 2, 3 }, { 4, 5, 6 } }");
});

Deno.test("emits C for header record fixed array fields", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `typedef struct Palette { unsigned char colors[4]; } Palette;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Palette } from "./lib.h"; function main(): i32 { const p: Palette = { colors: [1, 2, 3, 4] }; return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "u8 colors[4];");
  assertIncludes(c, ".colors = { 1, 2, 3, 4 }");
});

Deno.test("emits C for namespace project header record imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await Deno.writeTextFile(`${dir}/project.json`, `{"dependencies":{"gfx":"include/gfx.h"}}`);
  await Deno.writeTextFile(
    `${dir}/include/gfx.h`,
    `typedef struct Color { unsigned char r; unsigned char g; unsigned char b; unsigned char a; } Color; void draw(Color tint);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Gfx from "gfx"; function main(): i32 { const tint: Gfx.Color = { r: 1, g: 2, b: 3, a: 4 }; Gfx.draw(tint); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "typedef struct Color {");
  assertIncludes(c, "void draw(Color tint);");
  assertIncludes(c, "draw(tint);");
  assertNotIncludes(c, "Gfx.");
});

Deno.test("deduplicates direct and namespace project header imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await Deno.writeTextFile(`${dir}/project.json`, `{"dependencies":{"gfx":"include/gfx.h"}}`);
  await Deno.writeTextFile(
    `${dir}/include/gfx.h`,
    `typedef struct Color { unsigned char r; } Color; void draw(Color tint);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Color, draw } from "gfx"; import * as Gfx from "gfx"; function main(): i32 { const a: Color = { r: 1 }; const b: Gfx.Color = { r: 2 }; draw(a); Gfx.draw(b); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertCount(c, "} Color;", 1);
  assertCount(c, "void draw(Color tint);", 1);
  assertCount(c, "  draw(", 2);
  assertNotIncludes(c, "Gfx.");
});

Deno.test("emits C for direct project header record imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/include`);
  await Deno.writeTextFile(`${dir}/project.json`, `{"dependencies":{"gfx":"include/gfx.h"}}`);
  await Deno.writeTextFile(
    `${dir}/include/gfx.h`,
    `typedef struct Color { unsigned char rgba[4]; } Color; void draw(Color tint);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Color, draw } from "gfx"; function main(): i32 { const tint: Color = { rgba: [1, 2, 3, 4] }; draw(tint); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "typedef struct Color {");
  assertIncludes(c, "u8 rgba[4];");
  assertIncludes(c, "void draw(Color tint);");
  assertIncludes(c, "draw(tint);");
});

Deno.test("emits C for namespace header record imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `typedef struct Color { unsigned char r; unsigned char g; unsigned char b; unsigned char a; } Color; void draw(Color tint);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { const tint: Lib.Color = { r: 1, g: 2, b: 3, a: 4 }; Lib.draw(tint); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "} Color;");
  assertIncludes(c, "void draw(Color tint);");
  assertIncludes(c, "const Color tint = (Color){ .r = 1, .g = 2, .b = 3, .a = 4 };");
  assertIncludes(c, "draw(tint);");
  assertNotIncludes(c, "Lib.Color");
});

Deno.test("emits C prototypes for extern functions", () => {
  const source = `extern function puts(s: u8*): i32; function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 puts(u8* s);");
  assertNotIncludes(c, "static i32 puts(u8* s);");
  assertIncludes(c, "i32 main(void)");
});

Deno.test("emits extern prototypes before functions", () => {
  const source =
    `function main(): i32 { return add(20, 22); } extern function add(a: i32, b: i32): i32;`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertOrdered(c, "i32 add(i32 a, i32 b);", "i32 main(void)");
});

Deno.test("emits non-exported helpers with internal linkage", () => {
  const source =
    `function helper(): i32 { return 1; } export function api(): i32 { return helper(); } function main(): i32 { return api(); }`;
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
  assertIncludes(c, "typedef int32_t  i32;");
  assertIncludes(c, "i32 main(void)");
  assertIncludes(c, "return 0;");
});

Deno.test("emits C for const and function call", () => {
  const source =
    `function add(a: i32, b: i32): i32 { return a + b; }\nfunction main(): i32 { const x: i32 = add(20, 22); return x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 add(i32 a, i32 b)");
  assertIncludes(c, "const i32 x = add(20, 22);");
});

Deno.test("emits C preserving binary precedence", () => {
  const source = `function main(): i32 { return (1 + 2) * 3; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return (1 + 2) * 3;");
});

Deno.test("emits C preserving modulo precedence", () => {
  const source = `function main(): i32 { return 7 % (2 * 3); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return 7 % (2 * 3);");
});

Deno.test("emits C for postfix pointer expressions", () => {
  const source = `function main(): i32 { let x: i32 = 1; const p: i32* = x.&; return p.*; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32* p = &x;");
  assertIncludes(c, "return *p;");
});

Deno.test("emits C for canonical pointer reference and array syntax", () => {
  const source =
    `function main(): i32 { let x: i32 = 40; const p: Ptr<i32> = x.&; const r: Ref<i32> = x.&; const values: Array<i32, 2> = [p.*, r.* + 2]; return values[0] + values[1]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32* p = &x;");
  assertIncludes(c, "i32* r = &x;");
  assertIncludes(c, "const i32 values[2] = { *p, *r + 2 };");
});

Deno.test("emits C for slice indexing", () => {
  const source =
    `function first(values: Slice<i32>): i32 { return values[0]; } function main(): i32 { const values: Array<i32, 2> = [40, 2]; return first(values); }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "return values.data[0];");
});

Deno.test("emits C for array to slice calls", () => {
  const source =
    `function take(values: Slice<i32>): usize { return values.length(); } function main(): i32 { const values: Array<i32, 2> = [40, 2]; const len: usize = take(values); return 42; }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "typedef struct Slice_i32 { i32* data; usize length; } Slice_i32;");
  assertIncludes(c, "usize take(Slice_i32 values)");
  assertIncludes(c, "return values.length;");
  assertIncludes(c, "take((Slice_i32){ .data = values, .length = 2 })");
});

Deno.test("emits C for local array to slice initialization", () => {
  const source =
    `function main(): i32 { const values: Array<i32, 2> = [40, 2]; const slice: Slice<i32> = values; const len: usize = slice.length(); return 42; }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const Slice_i32 slice = (Slice_i32){ .data = values, .length = 2 };");
  assertIncludes(c, "const usize len = slice.length;");
});

Deno.test("emits C for array length field access", () => {
  const source =
    `function main(): i32 { const values: Array<i32, 2> = [40, 2]; const len: usize = values.length(); return 42; }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const usize len = 2;");
  assertNotIncludes(c, "values.length");
});

Deno.test("emits C for array data field access", () => {
  const source =
    `extern function first(values: Ptr<i32>): i32; function main(): i32 { const values: Array<i32, 2> = [40, 2]; return first(values.data); }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "return first(values);");
  assertNotIncludes(c, "values.data");
});

Deno.test("emits C for canonical inferred array syntax", () => {
  const source =
    `function main(): i32 { const values: Array<i32> = [40, 2]; return values[0] + values[1]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const i32 values[2] = { 40, 2 };");
});

Deno.test("emits C for field access through dereference", () => {
  const source =
    `type Vec2 = { x: i32; y: i32; }; function main(): i32 { const v: Vec2 = { x: 1, y: 2 }; const p: Vec2* = v.&; return p.*.x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return (*p).x;");
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
  const source =
    `type Block = { values: i32[3]; }; function main(): i32 { const b: Block = { values: [1, 2, 3] }; return b.values[0]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Block b = (Block){ .values = { 1, 2, 3 } };");
});

Deno.test("emits C for record literals and field access", () => {
  const source =
    `type Vec2 = { x: f64; y: f64; }; function getX(v: Vec2): f64 { return v.x; } function main(): i32 { const v: Vec2 = { x: 1.5, y: 2.5 }; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return v.x;");
  assertIncludes(c, "const Vec2 v = (Vec2){ .x = 1.5, .y = 2.5 };");
});

Deno.test("emits C for record literal arguments", () => {
  const source =
    `type Vec2 = { x: f64; y: f64; }; function getX(v: Vec2): f64 { return v.x; } function main(): i32 { const x: f64 = getX({ x: 1.5, y: 2.5 }); return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "getX((Vec2){ .x = 1.5, .y = 2.5 })");
});

Deno.test("emits C for nested record literals", () => {
  const source =
    `type Inner = { x: i32; }; type Outer = { inner: Inner; }; function main(): i32 { const o: Outer = { inner: { x: 42 } }; return o.inner.x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Outer o = (Outer){ .inner = (Inner){ .x = 42 } };");
});

Deno.test("emits C for functions returning records", () => {
  const source =
    `type Vec2 = { x: f64; y: f64; }; function add(a: Vec2, b: Vec2): Vec2 { return { x: a.x + b.x, y: a.y + b.y }; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "Vec2 add(Vec2 a, Vec2 b)");
  assertIncludes(c, "return (Vec2){ .x = a.x + b.x, .y = a.y + b.y };");
});

Deno.test("emits C for nested record returns", () => {
  const source =
    `type Vec2 = { x: f64; y: f64; }; function choose(ok: bool): Vec2 { if (ok) { return { x: 1.0, y: 2.0 }; } return { x: 3.0, y: 4.0 }; }`;
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
  const source =
    `function first(values: i32[3]): i32 { return values[0]; } function main(): i32 { const xs: i32[] = [1, 2, 3]; return first(xs); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 first(i32* values)");
  assertIncludes(c, "return first(xs);");
});

Deno.test("emits C for array literal arguments", () => {
  const source =
    `function first(values: i32[3]): i32 { return values[0]; } function main(): i32 { return first([1, 2, 3]); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return first((i32[3]){ 1, 2, 3 });");
});

Deno.test("emits C for while and assignment", () => {
  const source = `function main(): i32 { let x: i32 = 0; while (x < 3) { x = x + 1; } return x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "while (x < 3) {");
  assertIncludes(c, "x = x + 1;");
});

Deno.test("emits C for bool literals", () => {
  const source =
    `function flag(): bool { return true; } function main(): i32 { const ok: bool = false; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "b8 flag(void)");
  assertIncludes(c, "return true;");
  assertIncludes(c, "const b8 ok = false;");
});

Deno.test("emits C macros for wide integer literals", () => {
  const source =
    `function big(): u64 { return 18446744073709551615; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return UINT64_C(18446744073709551615);");
});

Deno.test("emits C for if else statements", () => {
  const source = `function main(): i32 { if (true) { return 1; } else { return 0; } }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "if (true) {");
  assertIncludes(c, "} else {");
});

Deno.test("emits C string literals for u8 pointer calls", () => {
  const source =
    `extern function puts(s: u8*): i32; function main(): i32 { return puts("hello"); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'return puts((u8*)"hello");');
});

Deno.test("emits C string literals for canonical u8 pointer calls", () => {
  const source =
    `extern function puts(s: Ptr<u8>): i32; function main(): i32 { return puts("hello"); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 puts(u8* s);");
  assertIncludes(c, 'return puts((u8*)"hello");');
});

Deno.test("emits C expression statements", () => {
  const source = `extern function tick(): void; function main(): i32 { tick(); return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "tick();");
});

Deno.test("emits C string literals for void pointer calls", () => {
  const source =
    `extern function consume(data: void*): void; function main(): i32 { consume("hello"); return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'consume((void*)"hello");');
});

Deno.test("emits C for canonical void pointer interop", () => {
  const source =
    `extern function consume(data: Ptr<void>): Ptr<void>; function main(): i32 { const bytes: Array<u8> = [1, 2, 3]; consume(bytes); return 42; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "void* consume(void* data);");
  assertIncludes(c, "const u8 bytes[3] = { 1, 2, 3 };");
  assertIncludes(c, "consume(bytes);");
});

Deno.test("emits C string literals for fixed u8 array calls", () => {
  const source =
    `extern function consume(data: u8[6]): void; function main(): i32 { consume("hello"); return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'consume((u8*)"hello");');
});

Deno.test("emits expected C string assignment expressions", () => {
  const source = `function main(): i32 { let data: void* = "one"; data = "two"; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'void* data = (void*)"one";');
  assertIncludes(c, 'data = (void*)"two";');
});

Deno.test("emits local C string arrays", () => {
  const source = `function main(): i32 { const text: u8[] = "hi"; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'const u8 text[3] = "hi";');
});

Deno.test("emits inferred array parameters as C pointers", () => {
  const source =
    `function first(values: i32[]): i32 { return values[0]; } function main(): i32 { const values: i32[] = [1, 2]; return first(values); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "static i32 first(i32* values)");
  assertIncludes(c, "return first(values);");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertNotIncludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output not to include ${needle}`);
}

function assertCount(haystack: Str, needle: Str, expected: usize): void {
  const actual = haystack.split(needle).length - 1;
  if (actual !== expected) {
    throw new Error(`Expected ${expected} occurrences of ${needle}, got ${actual}`);
  }
}

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertOrdered(haystack: Str, first: Str, second: Str): void {
  if (haystack.indexOf(first) >= haystack.indexOf(second)) {
    throw new Error(`Expected ${first} before ${second}`);
  }
}
