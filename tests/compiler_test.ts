import { check } from "checker";
import { compileFile } from "driver/compiler.ts";
import { emitC } from "emitter";
import { TypeCError } from "core/diagnostics.ts";
import { instantiateGenerics } from "core/generics.ts";
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

Deno.test("emits C for tagged unions", () => {
  const source = `
    union MaybeI32 { Some: i32; None; }
    function read(value: MaybeI32): i32 {
      switch (value.tag) {
        case 0:
          return value.Some;
        default:
          return 0;
      }
    }
    function main(): i32 {
      const value: MaybeI32 = MaybeI32.Some(42);
      return read(value);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct MaybeI32");
  assertIncludes(c, "static const i32 MaybeI32_Some_TAG = 0;");
  assertIncludes(
    c,
    "const MaybeI32 value = (MaybeI32){ .tag = MaybeI32_Some_TAG, .data.Some = 42 };",
  );
  assertIncludes(c, "return value.data.Some;");
});

Deno.test("rejects invalid tagged union constructors", () => {
  assertCompileError(
    `union MaybeI32 { Some: i32; None; } function main(): i32 { const value: MaybeI32 = MaybeI32.Some(); return 0; }`,
    "Union variant 'Some' expects 1 argument(s)",
  );
});

Deno.test("emits C for union type sugar", () => {
  const source = `
    type Value = i32 | f64;
    function main(): i32 {
      const value: Value = Value.i32(7);
      return value.i32;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct Value");
  assertIncludes(c, "static const i32 Value_i32_TAG = 0;");
  assertIncludes(c, "const Value value = (Value){ .tag = Value_i32_TAG, .data.i32 = 7 };");
  assertIncludes(c, "return value.data.i32;");
});

Deno.test("emits C for intersection type aliases", () => {
  const source = `
    type Named = { name: u8*; };
    type Aged = { age: i32; };
    type Person = Named & Aged;
    function main(): i32 {
      const person: Person = { name: "Ada", age: 42 };
      return person.age;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Person;");
  assertIncludes(c, "u8* name;");
  assertIncludes(c, "i32 age;");
  assertIncludes(c, "return person.age;");
});

Deno.test("rejects conflicting intersection fields", () => {
  assertCompileError(
    `type Named = { value: i32; }; type Labelled = { value: u8*; }; type Both = Named & Labelled; function main(): i32 { return 0; }`,
    "Duplicate field 'value'",
  );
});

Deno.test("emits C for static conditional type aliases", () => {
  const source = `
    type I32Box = { value: i32; };
    type F64Box = { value: f64; };
    type Selected = i32 extends i32 ? I32Box : F64Box;
    function main(): i32 {
      const box: Selected = { value: 7 };
      return box.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Selected;");
  assertIncludes(c, "i32 value;");
  assertIncludes(c, "return box.value;");
});

Deno.test("emits C for mapped type aliases", () => {
  const source = `
    type Point = { x: i32; y: f64; };
    type PointCopy = { [K in keyof Point]: Point[K] };
    function main(): i32 {
      const point: PointCopy = { x: 1, y: 2.0 };
      return point.x;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} PointCopy;");
  assertIncludes(c, "i32 x;");
  assertIncludes(c, "f64 y;");
  assertIncludes(c, "return point.x;");
});

Deno.test("checks function overload declarations", () => {
  const source = `
    function read(value: i32): i32;
    function read(value: bool): bool;
    function read(value: i32): i32 { return value; }
    function main(): i32 { return read(7); }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "static i32 read(i32 value)");
  assertIncludes(c, "return read(7);");
});

Deno.test("rejects ambiguous function overload calls", () => {
  assertCompileError(
    `
      function pick(value: i32): i32;
      function pick(value: i32): b8;
      function pick(value: i32): i32 { return value; }
      function main(): i32 { return pick(1); }
    `,
    "Call to overloaded function 'pick' is ambiguous",
  );
});

Deno.test("emits C for default parameters at call sites", () => {
  const source = `
    function add(x: i32, y: i32 = 1): i32 { return x + y; }
    function main(): i32 { return add(41); }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "static i32 add(i32 x, i32 y)");
  assertIncludes(c, "return add(41, 1);");
});

Deno.test("emits C for optional parameters at call sites", () => {
  const source = `
    function accept(value?: i32): i32 { return 0; }
    function main(): i32 { accept(42); return accept(); }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "static i32 accept(Optional_i32 value)");
  assertIncludes(c, "accept((Optional_i32){ .present = true, .value = 42 })");
  assertIncludes(c, "return accept((Optional_i32){ .present = false });");
});

Deno.test("checks default parameter types", () => {
  assertCompileError(
    `function bad(value: i32 = true): i32 { return value; } function main(): i32 { return bad(); }`,
    "Default value type 'bool' is not assignable to parameter 'value' type 'i32'",
  );
});

Deno.test("emits C for inferred local variable types", () => {
  const source = `
    function main(): i32 {
      const value = 7;
      const ok = true;
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 value = 7;");
  assertIncludes(c, "const b8 ok = true;");
});

Deno.test("emits C for inferred local optional types", () => {
  const source = `
    function main(): i32 {
      const present = Some<i32>(42);
      const empty = None<i32>();
      return present!;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const Optional_i32 present = (Optional_i32){ .present = true, .value = 42 };");
  assertIncludes(c, "const Optional_i32 empty = (Optional_i32){ .present = false };");
  assertIncludes(c, "return __typec_unwrap_Optional_i32(present);");
});

Deno.test("emits C for inferred local array types", () => {
  const source = `
    function main(): i32 {
      const values = [1, 2, 3];
      return values[1];
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 values[3] = { 1, 2, 3 };");
  assertIncludes(c, "return values[1];");
});

Deno.test("rejects empty inferred local arrays", () => {
  assertCompileError(
    `function main(): i32 { const values = []; return 0; }`,
    "Cannot infer empty array type",
  );
});

Deno.test("emits C for inferred local record types", () => {
  const source = `
    function main(): i32 {
      const point = { x: 1, y: 2 };
      return point.y;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct Record_");
  assertIncludes(c, "i32 x;");
  assertIncludes(c, "i32 y;");
  assertIncludes(c, "const Record_");
  assertIncludes(c, ".x = 1");
  assertIncludes(c, "return point.y;");
});

Deno.test("emits C for inferred function return types", () => {
  const source = `
    function add(a: i32, b: i32) {
      return a + b;
    }
    function main(): i32 {
      return add(1, 2);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 add(i32 a, i32 b);");
  assertIncludes(c, "i32 add(i32 a, i32 b) {");
  assertIncludes(c, "return add(1, 2);");
});

Deno.test("emits C for contextual slice array literals", () => {
  const source = `
    function sum(values: Slice<i32>): i32 {
      return values[0] + values[1];
    }
    function main(): i32 {
      const values: Slice<i32> = [40, 2];
      return sum([1, values[1]]);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(
    c,
    "const Slice_i32 values = (Slice_i32){ .data = (i32[]){ 40, 2 }, .length = 2 };",
  );
  assertIncludes(
    c,
    "return sum((Slice_i32){ .data = (i32[]){ 1, values.data[1] }, .length = 2 });",
  );
});

Deno.test("rejects empty contextual slice array literals", () => {
  assertCompileError(
    `function main(): i32 { const values: Slice<i32> = []; return 0; }`,
    "Cannot infer empty array type",
  );
});

Deno.test("compiles tagged union example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/tagged_union.tc", dir);

  assertIncludes(result.cSource, "MaybeI32_Some_TAG");
});

Deno.test("emits C for arenas", () => {
  const source = `
    function main(): i32 {
      const arena: Arena = arenaCreate();
      defer arenaDestroy(arena);
      const value: SafePtr<i32> = arenaAlloc(arena, 1);
      return 42;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct __typec_arena");
  assertIncludes(c, "__typec_arena* arena = __typec_arena_create();");
  assertIncludes(c, "const i32* value = ((i32*)__typec_arena_alloc(arena, sizeof(i32) * 1));");
  assertInOrder(
    c,
    "i32 __typec_return_",
    "__typec_arena_destroy(arena);",
    "return __typec_return_",
  );
});

Deno.test("rejects arena allocation without safe pointer target", () => {
  assertCompileError(
    `function main(): i32 { const arena: Arena = arenaCreate(); arenaAlloc(arena, 1); arenaDestroy(arena); return 0; }`,
    "arenaAlloc requires expected SafePtr<T> target type",
  );
});

Deno.test("compiles arena example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/arena.tc", dir);

  assertIncludes(result.cSource, "__typec_arena_alloc");
});

Deno.test("emits C for safe pointers", () => {
  const source = `
    function read(value: SafePtr<i32>): i32 { return value.*; }
    function raw_read(value: Ptr<i32>): i32 { return value.*; }
    function main(): i32 {
      const value: i32 = 42;
      const safe: SafePtr<i32> = value.&;
      return read(safe) + raw_read(safe) - 42;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32* value");
  assertIncludes(c, "const i32* safe = &value;");
});

Deno.test("rejects implicit raw pointer to safe pointer conversion", () => {
  assertCompileError(
    `function main(): i32 { const value: i32 = 42; const raw: Ptr<i32> = value.&; const safe: SafePtr<i32> = raw; return safe.*; }`,
    "Initializer type 'i32*' is not assignable to 'SafePtr<i32>'",
  );
});

Deno.test("compiles safe pointer example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/safe_ptr.tc", dir);

  assertIncludes(result.cSource, "const i32* safe = &value;");
});

Deno.test("emits C for defer before return", () => {
  const source =
    `function cleanup(): void { return; } function main(): i32 { defer cleanup(); return 42; }`;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 __typec_return_");
  assertInOrder(c, "i32 __typec_return_", "cleanup();", "return __typec_return_");
  assertCount(c, "cleanup();", 1);
});

Deno.test("rejects non-call defers", () => {
  assertCompileError(
    `function main(): i32 { defer 1 + 2; return 0; }`,
    "Defer statement requires a call expression",
  );
});

Deno.test("emits switch-local defers before break", () => {
  const source = `
    function outer(): void { return; }
    function inner(): void { return; }
    function main(): i32 {
      defer outer();
      switch (1) {
        case 1:
          defer inner();
          break;
      }
      return 42;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertInOrder(c, "case 1:", "inner();", "break;", "outer();");
  assertNotInOrder(c, "case 1:", "outer();", "break;");
});

Deno.test("emits for update before continue", () => {
  const source = `
    function skip(value: i32): bool { return value == 1; }
    function main(): i32 {
      let total: i32 = 0;
      for (let i: i32 = 0; i < 3; i++) {
        if (skip(i)) {
          continue;
        }
        total += i;
      }
      return total;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertInOrder(c, "if (skip(i)) {", "i++;", "continue;", "total += i;");
});

Deno.test("emits local defers before continue", () => {
  const source = `
    function cleanup(): void { return; }
    function main(): i32 {
      for (let i: i32 = 0; i < 3; i++) {
        defer cleanup();
        continue;
      }
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertInOrder(c, "cleanup();", "i++;", "continue;");
});

Deno.test("rejects continue outside loops", () => {
  assertCompileError(
    `function main(): i32 { continue; return 0; }`,
    "Continue statement is only valid inside a loop",
  );
});

Deno.test("compiles defer example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/defer.tc", dir);

  assertIncludes(result.cSource, "cleanup();");
});

Deno.test("emits C for module constants", () => {
  const program = parse(lex(`
    const ANSWER: i32 = 42;
    const NEGATIVE: i32 = -ANSWER;
    const SUM: i32 = ANSWER + 1;
    function main(): i32 {
      return ANSWER;
    }
  `));

  const c = emitC(check(resolve(program)));

  assertIncludes(c, "static const i32 ANSWER = 42;");
  assertIncludes(c, "static const i32 NEGATIVE = -42;");
  assertIncludes(c, "static const i32 SUM = 42 + 1;");
  assertIncludes(c, "return ANSWER;");
});

Deno.test("emits C for enums", () => {
  const program = parse(lex(`
    enum Key { Space = 32, Escape }
    function main(): i32 {
      const key: Key = Key.Space;
      return 42;
    }
  `));

  const c = emitC(check(resolve(program)));

  assertIncludes(c, "typedef i32 Key;");
  assertIncludes(c, "static const Key Key_Space = 32;");
  assertIncludes(c, "static const Key Key_Escape = 33;");
  assertIncludes(c, "const Key key = Key_Space;");
});

Deno.test("checks interfaces without C emission", () => {
  const program = parse(lex(`
    interface Drawable { draw(): void; }
    function main(): i32 { return 42; }
  `));

  const c = emitC(check(resolve(program)));

  assertNotIncludes(c, "Drawable");
  assertIncludes(c, "i32 main(void)");
});

Deno.test("rejects invalid interface declarations", () => {
  assertCompileError(
    `interface Drawable { draw(): void; draw(): void; } function main(): i32 { return 0; }`,
    "Duplicate interface method 'draw'",
  );
  assertCompileError(
    `interface Drawable { draw(value: Missing): void; } function main(): i32 { return 0; }`,
    "Unknown type 'Missing'",
  );
});

Deno.test("rejects interface names as value types", () => {
  assertCompileError(
    `interface Drawable { draw(): void; } function use(value: Drawable): void { return; } function main(): i32 { return 0; }`,
    "Unknown type 'Drawable'",
  );
});

Deno.test("compiles constrained generic example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/generic_constraint.tc", dir);

  assertIncludes(result.cSource, "read_Box");
  assertIncludes(result.cSource, "Holder_Box_get");
});

Deno.test("rejects unsatisfied generic function constraints", () => {
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } function read<T extends Readable>(value: T): i32 { return 0; } function main(): i32 { const value: Empty = { value: 1 }; return read<Empty>(value); }`,
    "Type 'Empty' does not satisfy 'Readable': missing method 'get'",
  );
});

Deno.test("rejects unsatisfied generic class constraints", () => {
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } class Holder<T extends Readable> { value: T; } function main(): i32 { const empty: Empty = { value: 1 }; const holder: Holder<Empty> = { value: empty }; return 0; }`,
    "Type 'Empty' does not satisfy 'Readable': missing method 'get'",
  );
});

Deno.test("rejects invalid generic class type refs", () => {
  assertCompileError(
    `class Box<T> { value: T; } function main(): i32 { const box: Box<i32, i64> = { value: 42 }; return 0; }`,
    "Generic class 'Box' expects 1 type argument(s)",
  );
});

Deno.test("compiles generic class example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/generic_class.tc", dir);

  assertIncludes(result.cSource, "} Box_i32;");
  assertIncludes(result.cSource, "Box_i32_get");
  assertNotIncludes(result.cSource, "Box<T>");
});

Deno.test("emits C for generic class new expressions inferred from assigned type", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box: Box<i32> = new Box(42);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value)");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(42);");
  assertIncludes(c, "return vBox_i32.get(&box);");
});

Deno.test("emits C for generic class new expressions inferred from arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function read(box: Box<i32>): i32 { return box.get(); }
    function main(): i32 { return read(new Box(42)); }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value)");
  assertIncludes(c, "return read(Box_i32_new(42));");
});

Deno.test("emits C for generic class new expressions inferred from nullish literal arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box = new Box(Some<i32>(42) ?? 0);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(
    c,
    "const Box_i32 box = Box_i32_new((Optional_i32){ .present = true, .value = 42 }.present ? (Optional_i32){ .present = true, .value = 42 }.value : 0);",
  );
});

Deno.test("emits C for generic class new expressions inferred from conditional literal arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box = new Box(true ? 1 : 2);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(true ? 1 : 2);");
});

Deno.test("emits C for generic class new expressions inferred from binary literal arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box = new Box(40 + 2);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(40 + 2);");
});

Deno.test("emits C for generic class new expressions inferred from unary literal arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box = new Box(-42);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(-42);");
});

Deno.test("emits C for generic class new expressions inferred from string arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
    }
    function main(): i32 {
      const box = new Box("hi");
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_u8_ Box_u8__new(u8* value);");
  assertIncludes(c, 'const Box_u8_ box = Box_u8__new((u8*)"hi");');
});

Deno.test("emits C for generic class new expressions inferred from parameter context", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function read(box: Box<i32>): i32 { return box.get(); }
    function main(): i32 { return read(new Box()); }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(void)");
  assertIncludes(c, "return read(Box_i32_new());");
});

Deno.test("emits C for generic class new expressions inferred from return context", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function make(): Box<i32> { return new Box(); }
    function main(): i32 { return make().get(); }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(void)");
  assertIncludes(c, "return Box_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from assignment target", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      let box: Box<i32> = new Box();
      box = new Box();
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = Box_i32_new();");
  assertIncludes(c, "box = Box_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from field assignment target", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      let box: Box<i32> = new Box();
      let holder: { box: Box<i32> } = { box };
      holder.box = new Box();
      return holder.box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "holder.box = Box_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from index contexts", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    class EmptyBox<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const values = [42];
      const tuple: [i32] = [42];
      const box = new Box(values[0]);
      const tupleBox = new Box(tuple[0]);
      const tupleEmpty: [EmptyBox<i32>] = [new EmptyBox()];
      let boxes: EmptyBox<i32>[1] = [new EmptyBox()];
      boxes[0] = new EmptyBox();
      return box.get() + tupleBox.get() + tupleEmpty[0].get() + boxes[0].get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = Box_i32_new(values[0]);");
  assertIncludes(c, "Box_i32 tupleBox = Box_i32_new(tuple._0);");
  assertIncludes(c, "._0 = EmptyBox_i32_new()");
  assertIncludes(c, "boxes[0] = EmptyBox_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from nullish fallback contexts", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      let maybe: Box<i32>? = None();
      const box = maybe ?? new Box();
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = maybe.present ? maybe.value : Box_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from conditional contexts", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const box: Box<i32> = true ? new Box() : new Box();
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const Box_i32 box = true ? Box_i32_new() : Box_i32_new();");
});

Deno.test("emits C for generic class new expressions inferred from aggregate expected contexts", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor() { }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const holder: { box: Box<i32> } = { box: new Box() };
      const boxes: Box<i32>[1] = [new Box()];
      return holder.box.get() + boxes[0].get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, ".box = Box_i32_new()");
  assertIncludes(c, "const Box_i32 boxes[1] = { Box_i32_new() };");
});

Deno.test("emits C for generic class new expressions inferred from address-of reference arguments", () => {
  const source = `
    class RefBox<T> {
      value: Ref<T>;
      constructor(value: Ref<T>) { this.value = value; }
      get(): T { return this.value.*; }
    }
    function main(): i32 {
      const value: i32 = 7;
      const box = new RefBox(value.&);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static RefBox_i32 RefBox_i32_new(i32* value);");
  assertIncludes(c, "const RefBox_i32 box = RefBox_i32_new(&value);");
});

Deno.test("emits C for generic class new expressions inferred from dereferenced pointer arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const value: i32 = 7;
      const ptr: Ptr<i32> = value.&;
      const box = new Box(ptr.*);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(*ptr);");
});

Deno.test("emits C for generic class new expressions inferred from non-null asserted optional arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const maybe: i32? = Some(7);
      const box = new Box(maybe!);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(i32 value);");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(__typec_unwrap_Optional_i32(maybe));");
});

Deno.test("emits C for generic class new expressions inferred from local arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const seed = 42;
      const box = new Box(seed);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = Box_i32_new(seed);");
});

Deno.test("emits C for generic class new expressions inferred from record-field arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const holder = { value: 42 };
      const box = new Box(holder.value);
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = Box_i32_new(holder.value);");
});

Deno.test("emits C for generic class new expressions inferred from generic class field arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function main(): i32 {
      const first = new Box(42);
      const second = new Box(first.value);
      return second.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 first = Box_i32_new(42);");
  assertIncludes(c, "Box_i32 second = Box_i32_new(first.value);");
});

Deno.test("emits C for generic class new expressions inferred from typed call arguments", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
      get(): T { return this.value; }
    }
    function make(): i32 { return 42; }
    function main(): i32 {
      const box = new Box(make());
      return box.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Box_i32 box = Box_i32_new(make());");
});

Deno.test("compiles generic function example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/generic.tc", dir);

  assertNotIncludes(result.cSource, "identity<T>");
  assertIncludes(result.cSource, "identity_i32");
  assertIncludes(result.cSource, "first_i32");
});

Deno.test("rejects invalid generic function calls", () => {
  assertCompileError(
    `function identity<T>(value: T): T { return value; } function main(): i32 { return identity<i32, i64>(42); }`,
    "Generic function 'identity' expects 1 type argument(s)",
  );
});

Deno.test("checks explicit class implements declarations", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(`
    interface Drawable { draw(): void; }
    class Ship implements Drawable { draw(): void { return; } }
    function main(): i32 { const ship: Ship = {}; ship.draw(); return 0; }
  `))))));

  assertIncludes(c, "Ship_draw");
});

Deno.test("rejects unsatisfied class implements declarations", () => {
  assertCompileError(
    `interface Drawable { draw(): void; } class Ship implements Drawable { value: i32; } function main(): i32 { return 0; }`,
    "Type 'Ship' does not satisfy 'Drawable': missing method 'draw'",
  );
  assertCompileError(
    `class Ship implements Missing { value: i32; } function main(): i32 { return 0; }`,
    "Unknown interface 'Missing'",
  );
});

Deno.test("compiles interface example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/interface.tc", dir);

  assertNotIncludes(result.cSource, "Drawable");
  assertIncludes(result.cSource, "Point_lengthSquared");
});

Deno.test("emits C for static class inheritance", () => {
  const source = `
    class Entity {
      x: i32;
      shifted(dx: i32): i32 { return this.x + dx; }
    }
    class Ship extends Entity {
      hp: i32;
      constructor(x: i32, hp: i32) {
        this.x = x;
        this.hp = hp;
      }
    }
    function main(): i32 {
      const ship: Ship = new Ship(1, 2);
      return ship.shifted(3) + ship.hp;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct {");
  assertInOrder(c, "i32 x;", "i32 hp;");
  assertIncludes(c, "static i32 Ship_shifted(Ship* this, i32 dx)");
  assertIncludes(c, "const Ship ship = Ship_new(1, 2);");
  assertIncludes(c, "vShip.shifted(&ship, 3)");
});

Deno.test("rejects invalid class inheritance", () => {
  assertCompileError(
    `class Ship extends Missing { hp: i32; } function main(): i32 { return 0; }`,
    "Unknown base class 'Missing'",
  );
  assertCompileError(
    `class A extends B { a: i32; } class B extends A { b: i32; } function main(): i32 { return 0; }`,
    "Inheritance cycle involving 'A'",
  );
});

Deno.test("emits C for class constructors and new expressions", () => {
  const source = `
    class Point {
      x: i32;
      y: i32;
      constructor(x: i32, y: i32) {
        this.x = x;
        this.y = y;
      }
    }
    function main(): i32 {
      const p: Point = new Point(2, 3);
      return p.x + p.y;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Point Point_new(i32 x, i32 y)");
  assertIncludes(c, "Point this = (Point){0};");
  assertIncludes(c, "this.x = x;");
  assertIncludes(c, "const Point p = Point_new(2, 3);");
});

Deno.test("rejects invalid class constructor calls", () => {
  assertCompileError(
    `class Point { x: i32; constructor(x: i32) { this.x = x; } } function main(): i32 { const p: Point = new Point(); return 0; }`,
    "Function 'Point.constructor' expects 1 arguments, got 0",
  );
  assertCompileError(
    `class Point { x: i32; } function main(): i32 { const p: Point = new Point(); return 0; }`,
    "Unknown function 'Point.constructor'",
  );
});

Deno.test("emits C for classes and methods", () => {
  const program = parse(lex(`
    class Vec2 {
      x: f64;
      y: f64;
      lengthSquared(): f64 {
        return this.x * this.x + this.y * this.y;
      }
    }
    function main(): i32 {
      const v: Vec2 = { x: 3.0, y: 4.0 };
      const d: f64 = v.lengthSquared();
      return 42;
    }
  `));

  const c = emitC(check(resolve(program)));

  assertIncludes(c, "typedef struct {");
  assertIncludes(c, "f64 x;");
  assertIncludes(c, "f64 y;");
  assertIncludes(c, "} Vec2;");
  assertIncludes(c, "typedef struct Vec2VTable {");
  assertIncludes(c, "  f64 (*lengthSquared)(Vec2*)");
  assertIncludes(c, "static const Vec2VTable vVec2 = {");
  assertIncludes(c, "  .lengthSquared = Vec2_lengthSquared");
  assertIncludes(c, "static f64 Vec2_lengthSquared(Vec2* this)");
  assertIncludes(c, "this->x * this->x + this->y * this->y");
  assertIncludes(c, "const f64 d = vVec2.lengthSquared(&v);");
});

Deno.test("emits C for imported class methods", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.tc`,
    `export class Vec2 { x: f64; y: f64; lengthSquared(): f64 { return this.x * this.x + this.y * this.y; } }`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { Vec2 } from "./lib.tc";
function main(): i32 {
  const v: Vec2 = { x: 3.0, y: 4.0 };
  const d: f64 = v.lengthSquared();
  if (d == 25.0) { return 42; }
  return 0;
}`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "f64 Vec2_lengthSquared(Vec2* this)");
  assertIncludes(c, "vVec2.lengthSquared(&v)");
});

Deno.test("compiles class example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/class.tc", dir);

  assertIncludes(result.cSource, "static f64 Vec2_lengthSquared(Vec2* this)");
  assertIncludes(result.cSource, "vVec2.lengthSquared(&v)");
});

Deno.test("compiles enum example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/enum.tc", dir);

  assertIncludes(result.cSource, "typedef i32 Key;");
  assertIncludes(result.cSource, "static const Key Key_Space = 32;");
  assertIncludes(result.cSource, "case 32:");
});

Deno.test("compiles switch example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/switch.tc", dir);

  assertIncludes(result.cSource, "switch (value)");
  assertIncludes(result.cSource, "case 0:");
  assertIncludes(result.cSource, "case 1:");
  assertIncludes(result.cSource, "return 42;");
});

Deno.test("compiles constants example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/constants.tc", dir);

  assertIncludes(result.cSource, "static const i32 BASE = 40;");
  assertIncludes(result.cSource, "static const i32 ANSWER = 40 + 2;");
  assertIncludes(result.cSource, "return ANSWER;");
});

Deno.test("emits C for aggregate constants", () => {
  const program = parse(lex(`
    type Color = { r: u8; g: u8; b: u8; a: u8; };
    const RAYWHITE: Color = { r: 245, g: 245, b: 245, a: 255 };
    const VALUES: Array<i32, 2> = [40, 2];
    const TITLE: Array<u8, 6> = "TypeC";
    function main(): i32 {
      return VALUES[1];
    }
  `));

  const c = emitC(check(resolve(program)));

  assertIncludes(
    c,
    "static const Color RAYWHITE = (Color){ .r = 245, .g = 245, .b = 245, .a = 255 };",
  );
  assertIncludes(c, "static const i32 VALUES[2] = { 40, 2 };");
  assertIncludes(c, 'static const u8 TITLE[6] = "TypeC";');
});

Deno.test("emits C for imported module constants", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/config.tc`, `export const ANSWER: i32 = 42;`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { ANSWER } from "./config.tc"; function main(): i32 { return ANSWER; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const i32 ANSWER = 42;");
  assertIncludes(c, "return ANSWER;");
});

Deno.test("emits C for namespace constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/config.tc`, `export const ANSWER: i32 = 42;`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Config from "./config.tc"; function main(): i32 { return Config.ANSWER; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const i32 Config_ANSWER = 42;");
  assertIncludes(c, "return Config_ANSWER;");
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

Deno.test("emits C for aliased named imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/math.tc`,
    `export function inc(value: i32): i32 { return value + 1; }`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import { inc as bump } from "./math.tc"; function main(): i32 { return bump(1); }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "i32 bump(i32 value)");
  assertIncludes(c, "return bump(1);");
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

Deno.test("emits C for namespace header enum imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `typedef enum KeyboardKey { KEY_NULL = 0, KEY_SPACE = 32, KEY_ESCAPE } KeyboardKey;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h";
function classify(key: Lib.KeyboardKey): i32 {
  switch (key) {
    case Lib.KeyboardKey.KEY_SPACE:
      return 42;
    default:
      return 0;
  }
}
function main(): i32 {
  const key: Lib.KeyboardKey = Lib.KeyboardKey.KEY_SPACE;
  return classify(key);
}`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "typedef i32 Lib_KeyboardKey;");
  assertIncludes(c, "static const Lib_KeyboardKey Lib_KeyboardKey_KEY_SPACE = 32;");
  assertIncludes(c, "const Lib_KeyboardKey key = Lib_KeyboardKey_KEY_SPACE;");
  assertIncludes(c, "case 32:");
});

Deno.test("emits C for header constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdint.h>\nstatic const int32_t ANSWER = 42;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { return Lib.ANSWER; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const i32 Lib_ANSWER = 42;");
  assertIncludes(c, "return Lib_ANSWER;");
});

Deno.test("emits C for header bool constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#include <stdbool.h>\nstatic const bool ENABLED = true;`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { if (Lib.ENABLED) { return 42; } else { return 0; } }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const b8 Lib_ENABLED = true;");
  assertIncludes(c, "if (Lib_ENABLED)");
});

Deno.test("emits C for header macro constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/lib.h`, `#define ANSWER (40 + 2)`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { return Lib.ANSWER; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const i32 Lib_ANSWER = 40 + 2;");
  assertIncludes(c, "return Lib_ANSWER;");
});

Deno.test("emits C for header string constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/lib.h`, `static const char *TITLE = "TypeC";`);
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, 'static const u8* Lib_TITLE = (u8*)"TypeC";');
});

Deno.test("emits C for header string array constant imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `int consume(unsigned char *text);\nstatic const unsigned char BYTES[] = "hi";`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { Lib.consume(Lib.BYTES); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, 'static const u8 Lib_BYTES[3] = "hi";');
  assertIncludes(c, "consume(Lib_BYTES);");
});

Deno.test("emits C for header string macro imports", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/lib.h`,
    `#define TITLE "TypeC"\nint consume(unsigned char *text);`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Lib from "./lib.h"; function main(): i32 { Lib.consume(Lib.TITLE); return 42; }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, 'static const u8* Lib_TITLE = (u8*)"TypeC";');
  assertIncludes(c, "consume(Lib_TITLE);");
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

Deno.test("emits C for variadic extern calls", () => {
  const program = parse(lex(`
    extern function log(format: u8*, ...args): c_int;
    function main(): i32 {
      log("%d", 42);
      return 42;
    }
  `));

  const c = emitC(check(resolve(program)));

  assertIncludes(c, "c_int log(u8* format, ...);");
  assertIncludes(c, 'log((u8*)"%d", 42);');
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

Deno.test("emits C for explicit numeric casts", () => {
  const source =
    `function main(): i32 { const width: i32 = 1280; const wf: f32 = @f32(width); const x: i32 = 1.8 as i32; return x; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const f32 wf = ((f32)width);");
  assertIncludes(c, "const i32 x = ((i32)1.8);");
});

Deno.test("emits C for fixed array zero initialization", () => {
  const source = `function main(): i32 { let values: Array<i32, 4> = {0}; return values[0]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 values[4] = {0};");
});

Deno.test("emits C for fixed array fill initialization", () => {
  const source = `function main(): i32 { let values: i32[4] = Array.fill(7); return values[2]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 values[4] = { 7, 7, 7, 7 };");
});

Deno.test("emits C for indexed fixed array fill initialization", () => {
  const source =
    `function main(): i32 { let values: usize[4] = Array.fill((i) => i + 1); return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "usize values[4] = { 0 + 1, 1 + 1, 2 + 1, 3 + 1 };");
});

Deno.test("emits C for fixed array zero initialization in records", () => {
  const source =
    `type Game = { values: i32[4]; }; function main(): i32 { const game: Game = { values: {0} }; return game.values[0]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Game game = (Game){ .values = {0} };");
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

Deno.test("emits C typedef for plain structs", () => {
  const source = `
    struct Vec2 {
      x: f32;
      y: f32;
    }
    function lengthSquared(v: Vec2): f32 {
      return v.x * v.x + v.y * v.y;
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "typedef struct Vec2 {");
  assertIncludes(c, "  f32 x;");
  assertIncludes(c, "  f32 y;");
  assertIncludes(c, "} Vec2;");
  assertIncludes(c, "f32 lengthSquared(Vec2 v)");
  assertIncludes(c, "return v.x * v.x + v.y * v.y;");
});

Deno.test("rejects invalid field types in plain structs", () => {
  assertCompileError(
    `struct Bad { field: Missing; } function main(): i32 { return 0; }`,
    "Unknown type 'Missing'",
  );
});

Deno.test("rejects methods in plain structs", () => {
  assertCompileError(
    `struct Vec2 { length(): f32 { return 0.0; } } function main(): i32 { return 0; }`,
    "Structs cannot have methods",
  );
});

Deno.test("rejects constructors in plain structs", () => {
  assertCompileError(
    `struct Vec2 { constructor() {} } function main(): i32 { return 0; }`,
    "Structs cannot have constructors",
  );
});

Deno.test("emits C typedef for comma-separated record aliases", () => {
  const source = `type Vec2 = { x: f32, y: f32, }; function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "  f32 x;");
  assertIncludes(c, "  f32 y;");
  assertOrdered(c, "  f32 x;", "  f32 y;");
});

Deno.test("compiles parenthesized type refs", () => {
  const source =
    `function id(value: (i32)): i32 { return value; } function main(): i32 { const value: (i32) = 1; return id(value); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "i32 id(i32 value)");
  assertIncludes(c, "const i32 value = 1;");
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

Deno.test("emits C for shorthand record literal fields", () => {
  const source =
    `type Point = { x: i32; y: i32; }; function make(x: i32, y: i32): Point { return { x, y }; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return (Point){ .x = x, .y = y };");
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

Deno.test("emits C for logical not", () => {
  const source =
    `function open(closed: bool): bool { return !closed; } function main(): i32 { if (!!open(false)) { return 42; } else { return 0; } }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return !closed;");
  assertIncludes(c, "if (!!open(false)) {");
});

Deno.test("emits C for conditional expressions", () => {
  const source =
    `function pick(flag: bool, a: i32, b: i32): i32 { return flag ? a : b; } function main(): i32 { return pick(true, 42, 0); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return flag ? a : b;");
});

Deno.test("emits C for optional value constructors", () => {
  const source = `
    function main(): i32 {
      const present: i32? = Some<i32>(42);
      const empty: i32? = None<i32>();
      return present! + (empty ?? 1);
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "Optional_i32");
  assertIncludes(c, "const Optional_i32 present = (Optional_i32){ .present = true, .value = 42 };");
  assertIncludes(c, "const Optional_i32 empty = (Optional_i32){ .present = false };");
});

Deno.test("emits C for contextual optional constructors", () => {
  const source = `
    function keep(value: i32?): i32? {
      return value;
    }
    function main(): i32 {
      const present: i32? = Some(42);
      const empty: i32? = None();
      keep(Some(7));
      keep(None());
      return present! + (empty ?? 1);
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const Optional_i32 present = (Optional_i32){ .present = true, .value = 42 };");
  assertIncludes(c, "const Optional_i32 empty = (Optional_i32){ .present = false };");
  assertIncludes(c, "keep((Optional_i32){ .present = true, .value = 7 });");
  assertIncludes(c, "keep((Optional_i32){ .present = false });");
});

Deno.test("emits C for contextual arrow function callbacks", () => {
  const source = `
    extern function apply(callback: (x: i32) => i32, value: i32): i32;
    function main(): i32 {
      return apply((x) => x + 1, 41);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 __typec_arrow_");
  assertIncludes(c, "i32 x)");
  assertIncludes(c, "return x + 1;");
  assertIncludes(c, "return apply(__typec_arrow_");
});

Deno.test("emits C for contextual zero-param arrow function callbacks", () => {
  const source = `
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      return result(() => 42);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 __typec_arrow_");
  assertIncludes(c, "(void)");
  assertIncludes(c, "return 42;");
  assertIncludes(c, "return result(__typec_arrow_");
});

Deno.test("emits C for contextual multi-param arrow function callbacks", () => {
  const source = `
    extern function apply(callback: (x: i32, y: i32) => i32): i32;
    function main(): i32 {
      return apply((x, y) => x + y);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 __typec_arrow_");
  assertIncludes(c, "i32 x, i32 y)");
  assertIncludes(c, "return x + y;");
  assertIncludes(c, "return apply(__typec_arrow_");
});

Deno.test("emits C for contextual single-param arrow function callbacks", () => {
  const source = `
    extern function apply(callback: (x: i32) => i32, value: i32): i32;
    function main(): i32 {
      return apply(x => x + 1, 41);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 __typec_arrow_");
  assertIncludes(c, "i32 x)");
  assertIncludes(c, "return x + 1;");
  assertIncludes(c, "return apply(__typec_arrow_");
});

Deno.test("rejects capturing contextual arrow function callbacks", () => {
  assertCompileError(
    `
      extern function apply(callback: (x: i32) => i32, value: i32): i32;
      function main(): i32 {
        const delta = 1;
        return apply((x) => x + delta, 41);
      }
    `,
    "Arrow function cannot capture local 'delta'",
  );
});

Deno.test("emits C for generic calls inferred from assigned result", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value: i32 = identity(42);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(42);");
  assertIncludes(c, "i32 identity_i32(i32 value) {");
});

Deno.test("emits C for generic calls inferred from ordinary arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value = identity(42);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(42);");
  assertIncludes(c, "return value;");
});

Deno.test("emits C for generic calls inferred from nullish literal arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value = identity(Some<i32>(42) ?? 0);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(
    c,
    "const i32 value = identity_i32((Optional_i32){ .present = true, .value = 42 }.present ? (Optional_i32){ .present = true, .value = 42 }.value : 0);",
  );
});

Deno.test("emits C for generic calls inferred from optional constructor arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value: i32? = identity(Some(42));
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Optional_i32 identity_i32_(Optional_i32 value);");
  assertIncludes(
    c,
    "const Optional_i32 value = identity_i32_((Optional_i32){ .present = true, .value = 42 });",
  );
});

Deno.test("emits C for generic calls inferred from conditional literal arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value = identity(true ? 1 : 2);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(true ? 1 : 2);");
});

Deno.test("emits C for generic calls inferred from binary literal arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value = identity(40 + 2);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(40 + 2);");
});

Deno.test("emits C for generic calls inferred from unary literal arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value = identity(-42);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(-42);");
});

Deno.test("emits C for generic calls inferred from string arguments", () => {
  const source = `
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const text: Ptr<u8> = identity("hi");
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static u8* identity_u8_(u8* value);");
  assertIncludes(c, 'const u8* text = identity_u8_((u8*)"hi");');
});

Deno.test("emits C for generic calls inferred from array arguments", () => {
  const source = `
    function first<T>(values: T[]): T {
      return values[0];
    }
    function main(): i32 {
      const value = first([42, 7]);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 first_i32(i32* values);");
  assertIncludes(c, "const i32 value = first_i32((i32[]){ 42, 7 });");
  assertIncludes(c, "return value;");
});

Deno.test("emits C for inferred function pointer local declarations", () => {
  const source = `
    function make(): i32 { return 1; }
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      const cb = make;
      return result(cb);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 (*cb)() = make;");
  assertIncludes(c, "return result(cb);");
});

Deno.test("emits C for generic calls inferred from address-of reference arguments", () => {
  const source = `
    extern function load<T>(ref: Ref<T>): T;
    function main(): i32 {
      const value: i32 = 7;
      const copy = load(value.&);
      return copy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 load_i32(i32* ref);");
  assertIncludes(c, "const i32 copy = load_i32(&value);");
});

Deno.test("emits C for generic calls inferred from dereferenced pointer arguments", () => {
  const source = `
    extern function identity<T>(value: T): T;
    function main(): i32 {
      const value: i32 = 7;
      const ptr: Ptr<i32> = value.&;
      const copy = identity(ptr.*);
      return copy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 copy = identity_i32(*ptr);");
});

Deno.test("emits C for generic calls inferred from non-null asserted optional arguments", () => {
  const source = `
    extern function identity<T>(value: T): T;
    function main(): i32 {
      const maybe: i32? = Some(7);
      const value = identity(maybe!);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 identity_i32(i32 value);");
  assertIncludes(c, "const i32 value = identity_i32(__typec_unwrap_Optional_i32(maybe));");
});

Deno.test("emits C for generic calls inferred from inferred callback local arguments", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const cb = make;
      const value = result(cb);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "const i32 (*cb)() = make;");
  assertIncludes(c, "const i32 value = result_i32(cb);");
});

Deno.test("emits C for function pointer tuple elements", () => {
  const source = `
    function make(): i32 { return 1; }
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      const callbacks: [() => i32] = [make];
      return result(callbacks[0]);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 (*_0)();");
  assertIncludes(c, "._0 = make");
  assertIncludes(c, "return result(callbacks._0);");
});

Deno.test("emits C for generic calls inferred from typed callback tuple elements", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const callbacks: [() => i32] = [make];
      const value = result(callbacks[0]);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "i32 (*_0)();");
  assertIncludes(c, "const i32 value = result_i32(callbacks._0);");
});

Deno.test("emits C for inferred function pointer arrays", () => {
  const source = `
    function make(): i32 { return 1; }
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      const callbacks = [make];
      return result(callbacks[0]);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 (*callbacks[1])() = { make };");
  assertIncludes(c, "return result(callbacks[0]);");
});

Deno.test("emits C for generic calls inferred from inferred callback array elements", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const callbacks = [make];
      const value = result(callbacks[0]);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "const i32 (*callbacks[1])() = { make };");
  assertIncludes(c, "const i32 value = result_i32(callbacks[0]);");
});

Deno.test("emits C for inferred record function pointer fields", () => {
  const source = `
    function make(): i32 { return 1; }
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      const holder = { cb: make };
      return result(holder.cb);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 (*cb)();");
  assertIncludes(c, ".cb = make");
  assertIncludes(c, "return result(holder.cb);");
});

Deno.test("emits C for generic calls inferred from inferred record callback fields", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const holder = { cb: make };
      const value = result(holder.cb);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "i32 (*cb)();");
  assertIncludes(c, "const i32 value = result_i32(holder.cb);");
});

Deno.test("emits C for function pointer local declarations", () => {
  const source = `
    function make(): i32 { return 1; }
    extern function result(callback: () => i32): i32;
    function main(): i32 {
      const cb: () => i32 = make;
      return result(cb);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 (*cb)() = make;");
  assertIncludes(c, "return result(cb);");
});

Deno.test("emits C for generic calls inferred from typed callback local arguments", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const cb: () => i32 = make;
      const value = result(cb);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "const i32 (*cb)() = make;");
  assertIncludes(c, "const i32 value = result_i32(cb);");
});

Deno.test("emits C for generic calls inferred from callback arguments", () => {
  const source = `
    extern function result<T>(callback: () => T): T;
    function make(): i32 { return 1; }
    function main(): i32 {
      const value = result(make);
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 result_i32(i32 (*callback)());");
  assertIncludes(c, "const i32 value = result_i32(make);");
});

Deno.test("emits C for generic calls inferred from method parameter contexts", () => {
  const source = `
    class Sink {
      constructor() { }
      consume(value: i32): i32 { return value; }
    }
    function produce<T>(): T { return 42; }
    function main(): i32 {
      const sink = new Sink();
      return sink.consume(produce());
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "return vSink.consume(&sink, produce_i32());");
});

Deno.test("emits C for generic calls inferred from expected contexts", () => {
  const source = `
    type Box = { value: i32; };
    function identity<T>(value: T): T {
      return value;
    }
    function consume(value: i32): i32 {
      return value;
    }
    function make(): i32 {
      return identity(42);
    }
    function main(): i32 {
      let value: i32 = 0;
      const seed = 9;
      const copy = identity(seed);
      let box: Box = { value: 0 };
      const inferredBox = { value: 13 };
      const fieldCopy = identity(box.value);
      const inferredFieldCopy = identity(inferredBox.value);
      value = identity(5);
      box.value = identity(11);
      return consume(identity(7)) + make() + value + copy + box.value + fieldCopy + inferredFieldCopy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 identity_i32(i32 value);");
  assertIncludes(c, "return identity_i32(42);");
  assertIncludes(c, "const i32 seed = 9;");
  assertIncludes(c, "const i32 copy = identity_i32(seed);");
  assertIncludes(c, "value = identity_i32(5);");
  assertIncludes(c, "const i32 fieldCopy = identity_i32(box.value);");
  assertIncludes(c, "const i32 inferredFieldCopy = identity_i32(inferredBox.value);");
  assertIncludes(c, "box.value = identity_i32(11);");
  assertIncludes(
    c,
    "return consume(identity_i32(7)) + make() + value + copy + box.value + fieldCopy + inferredFieldCopy;",
  );
});

Deno.test("emits C for generic calls inferred from index contexts", () => {
  const source = `
    function identity<T>(value: T): T { return value; }
    function main(): i32 {
      let values: i32[2] = [0, 1];
      const tuple: [i32, i32] = [identity(2), identity(3)];
      values[0] = identity(7);
      const copy = identity(values[1]);
      const tupleCopy = identity(tuple[1]);
      return values[0] + copy + tuple[0] + tupleCopy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "._0 = identity_i32(2)");
  assertIncludes(c, "values[0] = identity_i32(7);");
  assertIncludes(c, "const i32 copy = identity_i32(values[1]);");
  assertIncludes(c, "const i32 tupleCopy = identity_i32(tuple._1);");
});

Deno.test("emits C for generic calls inferred from nullish fallback contexts", () => {
  const source = `
    function produce<T>(): T { return 42; }
    function main(): i32 {
      let maybe: i32? = None();
      const value = maybe ?? produce();
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 value = maybe.present ? maybe.value : produce_i32();");
});

Deno.test("emits C for generic calls inferred from conditional contexts", () => {
  const source = `
    function produce<T>(): T { return 42; }
    function main(): i32 {
      const value: i32 = true ? produce() : produce();
      return value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 value = true ? produce_i32() : produce_i32();");
});

Deno.test("emits C for generic calls inferred from aggregate expected contexts", () => {
  const source = `
    type Holder = { value: i32; };
    function produce<T>(): T { return 42; }
    function main(): i32 {
      const holder: Holder = { value: produce() };
      const values: i32[2] = [produce(), produce()];
      return holder.value + values[0] + values[1];
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 produce_i32(void);");
  assertIncludes(c, ".value = produce_i32()");
  assertIncludes(c, "const i32 values[2] = { produce_i32(), produce_i32() };");
});

Deno.test("emits C for generic calls inferred from inferred named local fields", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
    }
    function identity<T>(value: T): T { return value; }
    function main(): i32 {
      const box = new Box(42);
      const copy = identity(box.value);
      return copy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 copy = identity_i32(box.value);");
});

Deno.test("emits C for generic calls inferred from typed call arguments", () => {
  const source = `
    function make(): i32 { return 42; }
    function identity<T>(value: T): T { return value; }
    function main(): i32 {
      const copy = identity(make());
      return copy;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "const i32 copy = identity_i32(make());");
});

Deno.test("rejects invalid optional value constructors", () => {
  assertCompileError(
    `function main(): i32 { const value: i32? = Some<i32>(); return 0; }`,
    "Some expects 1 arguments, got 0",
  );
  assertCompileError(
    `function main(): i32 { const value: i32? = None<i32>(1); return 0; }`,
    "None expects 0 arguments, got 1",
  );
  assertCompileError(
    `function main(): i32 { const value = Some(1); return 0; }`,
    "Some requires exactly one type argument",
  );
});

Deno.test("emits C for optional type spelling", () => {
  const source =
    `function keep(value: i32?): i32? { return value; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "typedef struct Optional_i32 { b8 present; i32 value; } Optional_i32;");
  assertIncludes(c, "Optional_i32 keep(Optional_i32 value)");
});

Deno.test("emits C for non-null assertions", () => {
  const source =
    `function unwrap(value: i32?): i32 { return value!; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "static inline i32 __typec_unwrap_Optional_i32(Optional_i32 value)");
  assertIncludes(c, "return __typec_unwrap_Optional_i32(value);");
});

Deno.test("emits C for nullish coalescing", () => {
  const source =
    `function fallback(value: i32?): i32 { return value ?? 42; } function fallbackElvis(value: i32?): i32 { return value ?: 7; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return value.present ? value.value : 42;");
  assertIncludes(c, "return value.present ? value.value : 7;");
});

Deno.test("emits C for optional field chaining", () => {
  const source =
    `type Point = { x: i32; }; function get(point: Point?): i32? { return point?.x; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(
    c,
    "return point.present ? (Optional_i32){ .present = true, .value = point.value.x } : (Optional_i32){ .present = false };",
  );
});

Deno.test("emits C for bitwise integer operators", () => {
  const source =
    `function mask(value: u32, shift: u8): u32 { return (~value & 255) | (value >>> shift); } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return ~value & 255 | value >> shift;");
});

Deno.test("emits C for logical binary operators", () => {
  const source =
    `function both(a: bool, b: bool, c: bool): bool { return a || b && c; } function main(): i32 { return 0; }`;
  const checked = check(resolve(parse(lex(source))));
  const c = emitC(checked);
  assertIncludes(c, "return a || b && c;");
});

Deno.test("emits C for compound assignments", () => {
  const source =
    `function update(value: u32): u32 { let bits: u32 = value; bits += 1; bits &= 255; bits >>>= 1; return bits; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "bits += 1;");
  assertIncludes(c, "bits &= 255;");
  assertIncludes(c, "bits >>= 1;");
});

Deno.test("emits C for field and index assignment targets", () => {
  const source =
    `type Vec2 = { x: i32, y: i32 }; type Ship = { pos: Vec2, values: i32[2] }; function main(): i32 { let ship: Ship = { pos: { x: 1, y: 2 }, values: [3, 4] }; ship.pos.x += 5; ship.values[1] = ship.pos.x; ship.values[1]++; return ship.values[1]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "ship.pos.x += 5;");
  assertIncludes(c, "ship.values[1] = ship.pos.x;");
  assertIncludes(c, "ship.values[1]++;");
});

Deno.test("emits C for increment and decrement statements", () => {
  const source =
    `function update(value: i32): i32 { let current: i32 = value; current++; --current; return current; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "current++;");
  assertIncludes(c, "current--;");
});

Deno.test("emits C for do while statements", () => {
  const source =
    `function update(value: i32): i32 { let current: i32 = value; do { current++; } while (current < 3); return current; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "do {");
  assertIncludes(c, "current++;");
  assertIncludes(c, "while (current < 3);");
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

Deno.test("emits C for else if chains", () => {
  const source =
    `function main(): i32 { if (false) { return -1; } else if (true) { return 0; } else { return 1; } }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "} else {");
  assertIncludes(c, "if (true) {");
});

Deno.test("emits C for empty statements", () => {
  const source = `function main(): i32 { ; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "  ;");
});

Deno.test("compiles trailing commas in supported lists", () => {
  const source =
    `function id(value: i32,): i32 { return value; } function main(): i32 { const values: i32[] = [1, 2,]; return id(values[0],); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "return id(values[0]);");
});

Deno.test("compiles numeric separators", () => {
  const source = `function main(): i32 { const value: i32 = 1_024; return value; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const i32 value = 1024;");
});

Deno.test("emits C string literals for u8 pointer calls", () => {
  const source =
    `extern function puts(s: u8*): i32; function main(): i32 { return puts("hello"); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'return puts((u8*)"hello");');
});

Deno.test("emits C string literals for single-quoted strings", () => {
  const source =
    `extern function puts(s: u8*): i32; function main(): i32 { return puts('hello'); }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'return puts((u8*)"hello");');
});

Deno.test("emits C string literals for plain template literals", () => {
  const source =
    "extern function puts(s: u8*): i32; function main(): i32 { return puts(`hello\\nTypeC`); }";
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'return puts((u8*)"hello\\\\nTypeC");');
});

Deno.test("emits C string literals for static template interpolation", () => {
  const source =
    'extern function puts(s: u8*): i32; function main(): i32 { return puts(`hello ${"TypeC"} ${42}`); }';
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'return puts((u8*)"hello TypeC 42");');
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

Deno.test("emits C for basic for loops", () => {
  const source =
    `function main(): i32 { let total: i32 = 0; for (let i: usize = 0; i < 3; i++) { total += 2; } return total; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "usize i = 0;");
  assertIncludes(c, "while (i < 3)");
  assertInOrder(c, "total += 2;", "i++;", "return total;");
});

Deno.test("emits C for tuple literals and indexing", () => {
  const source = `function main(): i32 { const pair: [u8*, i32] = ["age", 42]; return pair[1]; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "typedef struct Tuple_u8_x2a__i32 {");
  assertIncludes(c, "u8* _0;");
  assertIncludes(c, "i32 _1;");
  assertIncludes(
    c,
    'const Tuple_u8_x2a__i32 pair = (Tuple_u8_x2a__i32){ ._0 = (u8*)"age", ._1 = 42 };',
  );
  assertIncludes(c, "return pair._1;");
});

Deno.test("rejects tuple index out of bounds", () => {
  assertCompileError(
    `function main(): i32 { const pair: [u8*, i32] = ["age", 42]; return pair[2]; }`,
    "Tuple index 2 is out of bounds",
  );
});

Deno.test("rejects dynamic tuple indexes", () => {
  assertCompileError(
    `function main(): i32 { const pair: [u8*, i32] = ["age", 42]; const index: usize = 1; return pair[index]; }`,
    "Tuple index must be an integer literal",
  );
});

Deno.test("rejects tuple literal length mismatch", () => {
  assertCompileError(
    `function main(): i32 { const pair: [u8*, i32] = ["age"]; return 0; }`,
    "Tuple literal length 1 does not match expected length 2",
  );
});

Deno.test("emits C for record destructuring", () => {
  const source = `
    type Point = { x: i32; y: i32 };
    function main(): i32 {
      const point: Point = { x: 1, y: 2 };
      const { x, y } = point;
      return x + y;
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const i32 x = point.x;");
  assertIncludes(c, "const i32 y = point.y;");
});

Deno.test("emits C for tuple destructuring", () => {
  const source = `
    function main(): i32 {
      const pair: [i32, i32] = [1, 2];
      const [a, b] = pair;
      return a + b;
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const i32 a = pair._0;");
  assertIncludes(c, "const i32 b = pair._1;");
});

Deno.test("emits C for fixed array destructuring", () => {
  const source = `
    function main(): i32 {
      const values: i32[2] = [1, 2];
      const [a, b] = values;
      return a + b;
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const i32 a = values[0];");
  assertIncludes(c, "const i32 b = values[1];");
});

Deno.test("rejects destructuring too many array elements", () => {
  assertCompileError(
    `function main(): i32 { const values: i32[1] = [1]; const [a, b] = values; return a; }`,
    "Array destructuring expects at most 1 binding(s), got 2",
  );
});

Deno.test("emits C for record spread", () => {
  const source =
    `type Point2 = { x: i32; y: i32; }; type Point3 = { x: i32; y: i32; z: i32; }; function main(): i32 { const a: Point2 = { x: 1, y: 2 }; const b: Point3 = { ...a, y: 4, z: 3 }; return b.y; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Point3 b = (Point3){ .x = a.x, .y = 4, .z = 3 };");
});

Deno.test("emits C for record rest destructuring", () => {
  const source =
    `type Point3 = { x: i32; y: i32; z: i32; }; function main(): i32 { const point: Point3 = { x: 1, y: 2, z: 3 }; const { x, ...rest } = point; return x + rest.y; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const i32 x = point.x;");
  assertIncludes(c, "const Record_");
  assertIncludes(c, ".y = point.y");
  assertIncludes(c, "return x + rest.y;");
});

Deno.test("rejects non-record spread operands", () => {
  assertCompileError(
    `type Point = { x: i32; }; function main(): i32 { const p: Point = { ...1, x: 2 }; return p.x; }`,
    "Record spread operand must be a record type",
  );
});

Deno.test("emits C for for-of arrays", () => {
  const source =
    `function main(): i32 { const values: i32[] = [1, 2, 3]; let total: i32 = 0; for (const value of values) { total += value; } return total; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "usize __typec_for_of_");
  assertIncludes(c, "const i32 value = values[__typec_for_of_");
  assertInOrder(c, "while (__typec_for_of_", "total += value;", "__typec_for_of_");
});

Deno.test("emits C for for-of slices", () => {
  const source =
    `function sum(values: Slice<i32>): i32 { let total: i32 = 0; for (const value of values) { total += value; } return total; } function main(): i32 { return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, ".length");
  assertIncludes(c, "const i32 value = values.data[__typec_for_of_");
});

Deno.test("rejects non-array for-of iterables", () => {
  assertCompileError(
    `function main(): i32 { for (const value of 1) {} return 0; }`,
    "For-of iterable must be an array or slice",
  );
});

Deno.test("emits C for for-in record fields", () => {
  const source =
    `extern function puts(value: u8*): i32; type Point = { x: i32; y: i32; }; function main(): i32 { const point: Point = { x: 1, y: 2 }; for (const key in point) { puts(key); } return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, 'const u8* key = "x";');
  assertIncludes(c, 'const u8* key = "y";');
  assertInOrder(c, '"x"', "puts(key);", '"y"');
});

Deno.test("emits C for for-in enum members", () => {
  const source =
    `enum Direction { Up, Down } function main(): i32 { let total: i32 = 0; for (const key in Direction) { switch (key) { case Direction.Up: total += 1; case Direction.Down: total += 2; } } return total; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "const Direction key = Direction_Up;");
  assertIncludes(c, "const Direction key = Direction_Down;");
});

Deno.test("rejects invalid for-in iterables", () => {
  assertCompileError(
    `function main(): i32 { for (const key in 1) {} return 0; }`,
    "For-in iterable must be a record, class, or enum",
  );
});

Deno.test("rejects non-bool for conditions", () => {
  assertCompileError(
    `function main(): i32 { for (let i: usize = 0; 1; i++) {} return 0; }`,
    "While condition type 'i32' is not assignable to 'bool'",
  );
});

function assertCompileError(source: Str, message: Str): void {
  try {
    emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  } catch (error) {
    if (!(error instanceof TypeCError)) throw error;
    const text = error.diagnostics.map((diagnostic) => diagnostic.message).join("\n");
    if (!text.includes(message)) throw new Error(`Expected diagnostic ${message}, got ${text}`);
    return;
  }
  throw new Error(`Expected diagnostic ${message}`);
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}

function assertNotIncludes(haystack: Str, needle: Str): void {
  if (haystack.includes(needle)) throw new Error(`Expected output not to include ${needle}`);
}

function assertInOrder(haystack: Str, ...needles: Str[]): void {
  let offset: usize = 0;
  for (const needle of needles) {
    const index = haystack.indexOf(needle, offset);
    if (index < 0) throw new Error(`Expected output to include ${needle} after offset ${offset}`);
    offset = index + needle.length;
  }
}

function assertNotInOrder(haystack: Str, ...needles: Str[]): void {
  try {
    assertInOrder(haystack, ...needles);
  } catch {
    return;
  }
  throw new Error(`Expected output not to include ordered sequence ${needles.join(" -> ")}`);
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
