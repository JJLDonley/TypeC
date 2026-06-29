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

Deno.test("allows class methods to call methods through this", () => {
  const source = `
    class Vec {
      x: i32;

      get(): i32 {
        return this.x;
      }

      twice(): i32 {
        return this.get() + this.get();
      }
    }

    function main(): i32 {
      const value: Vec = { x: 21 };
      return value.twice() - 42;
    }
  `;
  const program = check(resolve(instantiateGenerics(parse(lex(source)))));
  const cSource = emitC(program);
  if (!cSource.includes("Vec_twice")) throw new Error("Expected emitted class method");
  if (!cSource.includes("Vec_get(this)")) {
    throw new Error("Expected this method call to pass receiver pointer");
  }
});

Deno.test("allows drawable class methods to call helper methods through this", () => {
  const source = `
    class Asteroid {
      radius: f32;

      point(index: i32): f32 {
        return this.radius + @f32(index);
      }

      draw(): f32 {
        return this.point(1) + this.point(2);
      }
    }

    function main(): i32 {
      const asteroid: Asteroid = { radius: 39.0 };
      return @i32(asteroid.draw()) - 81;
    }
  `;
  const program = check(resolve(instantiateGenerics(parse(lex(source)))));
  const cSource = emitC(program);
  if (!cSource.includes("Asteroid_point(this, 1)")) {
    throw new Error("Expected this helper method call to pass receiver pointer");
  }
});

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
        case MaybeI32.Some:
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

Deno.test("emits C for tagged union tag checks", () => {
  const source = `
    union MaybeI32 { Some: i32; None; }
    function read(value: MaybeI32): i32 {
      if (value.tag == MaybeI32.Some) {
        return value.Some;
      }
      return 0;
    }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "if (value.tag == MaybeI32_Some_TAG)");
  assertIncludes(c, "return value.data.Some;");
});

Deno.test("rejects unchecked and mismatched tagged union payload access", () => {
  assertCompileError(
    `union MaybeI32 { Some: i32; Other: i32; } function read(value: MaybeI32): i32 { return value.Some; }`,
    "Union value 'value' payload 'Some' requires tag narrowing",
  );
  assertCompileError(
    `union MaybeI32 { Some: i32; Other: i32; } function read(value: MaybeI32): i32 { if (value.tag == MaybeI32.Some) { return value.Other; } return 0; }`,
    "Union value 'value' is narrowed to 'Some'",
  );
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
      if (value.tag == Value.i32) {
        return value.i32;
      }
      return 0;
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

Deno.test("emits C for rest parameters at call sites", () => {
  const source = `
    function sum(...values: i32[]): i32 {
      let total: i32 = 0;
      for (const value of values) {
        total += value;
      }
      return total;
    }
    function main(): i32 {
      return sum() + sum(1) + sum(2, 3);
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "static i32 sum(Slice_i32 values)");
  assertIncludes(c, "sum((Slice_i32){ .data = NULL, .length = 0 })");
  assertIncludes(c, "sum((Slice_i32){ .data = (i32[]){ 1 }, .length = 1 })");
  assertIncludes(c, "sum((Slice_i32){ .data = (i32[]){ 2, 3 }, .length = 2 })");
});

Deno.test("checks rest parameter argument types", () => {
  assertCompileError(
    `function sum(...values: i32[]): i32 { return 0; } function main(): i32 { return sum(1, true); }`,
    "Argument 2 type 'bool' is not assignable to 'i32'",
  );
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

Deno.test("rejects required parameters after default parameters", () => {
  assertCompileError(
    `function bad(first: i32 = 1, second: i32): i32 { return first + second; } function main(): i32 { return bad(2, 3); }`,
    "Required parameter 'second' cannot follow optional/default parameter",
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

Deno.test("checks 0.1 array tuple slice and bounds rules", () => {
  const source = `
    function pair(): [i32, bool] { return [7, true]; }
    function pass(values: Slice<i32>): Slice<i32> { return values; }
    function main(): i32 {
      let values: i32[3] = [1, 2, 3];
      values[1] = 4;
      const tuple: [i32, i32] = [values[0], values[1]];
      const [a, b] = tuple;
      const made: i32[3] = Array.fill((i) => @i32(i) + 1);
      const middle: Slice<i32> = values.slice(1, 3);
      const again: Slice<i32> = pass(middle);
      const p: [i32, bool] = pair();
      return a + b + made[2] + again[0] + p[0];
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "i32 values[3] = { 1, 2, 3 };");
  assertIncludes(c, "values[1] = 4;");
  assertIncludes(c, "const i32 a = tuple._0;");
  assertIncludes(c, "const i32 b = tuple._1;");
  assertIncludes(c, "const i32 made[3] = { ((i32)0) + 1, ((i32)1) + 1, ((i32)2) + 1 };");
  assertIncludes(c, "const Slice_i32 middle = (Slice_i32){ .data = values + 1, .length = 3 - 1 };");
  assertIncludes(c, "const Slice_i32 again = pass(middle);");
  assertIncludes(c, "return a + b + made[2] + again.data[0] + p._0;");

  assertCompileError(
    `function main(): i32 { const values: i32[2] = [1]; return 0; }`,
    "Array length 1 is not assignable to 'i32[2]'",
  );
  assertCompileError(
    `function main(): i32 { const pair: [i32, bool] = [1]; return 0; }`,
    "Tuple literal length 1 does not match expected length 2",
  );
  assertCompileError(
    `function main(): i32 { const pair: [i32, i32] = [1, 2]; return pair[2]; }`,
    "Tuple index 2 is out of bounds",
  );
  assertCompileError(
    `function main(): i32 { const pair: [i32, i32] = [1, 2]; const i: usize = 0; return pair[i]; }`,
    "Tuple index must be an integer literal",
  );
  assertCompileError(
    `function main(): i32 { const values: i32[1] = [1]; const [a, b] = values; return a; }`,
    "Array destructuring expects at most 1 binding(s), got 2",
  );
  assertCompileError(
    `function main(): i32 { const values: i32[2] = [1, 2]; const bad: Slice<i32> = values.slice(0, 3); return 0; }`,
    "slice end 3 is out of bounds for length 2",
  );
});

Deno.test("checks 0.1 enum tagged union and exhaustiveness rules", async () => {
  const source = `
    enum Key: i32 { Space = 32, Escape = 256 }
    union MaybeI32 { Some: i32; None; }
    function keyValue(key: Key): i32 {
      switch (key) {
        case Key.Space:
          return 1;
        case Key.Escape:
          return 2;
      }
      return 0;
    }
    function read(value: MaybeI32): i32 {
      switch (value.tag) {
        case MaybeI32.Some:
          return value.Some;
        case MaybeI32.None:
          return 0;
      }
      return 0;
    }
    function main(): i32 {
      const value: MaybeI32 = MaybeI32.Some(40);
      return keyValue(Key.Space) + read(value);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef i32 Key;");
  assertIncludes(c, "static const Key Key_Space = 32;");
  assertIncludes(c, "static const i32 MaybeI32_Some_TAG = 0;");
  assertIncludes(
    c,
    "const MaybeI32 value = (MaybeI32){ .tag = MaybeI32_Some_TAG, .data.Some = 40 };",
  );
  assertIncludes(c, "switch (key)");
  assertIncludes(c, "case 32:");
  assertIncludes(c, "switch (value.tag)");
  assertIncludes(c, "case 0:");
  assertIncludes(c, "return value.data.Some;");

  assertCompileError(
    `enum Key: i32 { Space = 32, Escape = 256 } function main(): i32 { const key: Key = Key.Space; switch (key) { case Key.Space: return 1; } return 0; }`,
    "Non-exhaustive switch on 'Key' is missing case(s): Key.Escape",
  );
  assertCompileError(
    `union MaybeI32 { Some: i32; None; } function main(): i32 { const value: MaybeI32 = MaybeI32.None(); switch (value.tag) { case MaybeI32.Some: return value.Some; } return 0; }`,
    "Non-exhaustive switch on 'MaybeI32' is missing case(s): MaybeI32.None",
  );
  assertCheckSucceeds(
    `enum Key: i32 { Space = 32, Escape = 256 } function main(): i32 { const key: Key = Key.Space; switch (key) { case Key.Space: return 1; default: return 0; } }`,
  );
  assertCompileError(
    `enum Key: i32 { Space = 32, Escape = 256 } function main(): i32 { const key: Key = Key.Space; switch (key) { case Key.Space: return 1; case Key.Space: return 2; default: return 0; } }`,
    "Duplicate switch case '32'",
  );
  assertCompileError(
    `union MaybeI32 { Some: i32; None; } function main(): i32 { const value: MaybeI32 = MaybeI32.Some(); return 0; }`,
    "Union variant 'Some' expects 1 argument(s)",
  );

  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/main.tc`, source);
  const result = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  assertIncludes(result.cSource, "typedef struct MaybeI32");
});

Deno.test("checks 0.1 type alias and static-only type rules", () => {
  const source = `
    type Count = i32;
    type Point = { x: i32; y: i32; };
    type Named = { name: u8*; };
    type Located = Named & Point;
    type Selected = i32 extends i32 ? Located : Named;
    type PointCopy = { [K in keyof Point]: Point[K] };
    function main(): i32 {
      const point: Point = { x: 1, y: 2 };
      const located: Selected = { name: "Ada", x: 1, y: 2 };
      const copy: PointCopy = { x: point.x, y: point.y };
      return located.x + copy.y;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  assertIncludes(c, "typedef i32 Count;");
  assertIncludes(c, "} Point;");
  assertIncludes(c, "} Selected;");
  assertIncludes(c, "} PointCopy;");

  assertCompileError(
    `type One = 1; function main(): i32 { const value: One = 1; return 0; }`,
    "Literal-only type alias 'One' cannot be used as a value type",
  );
  assertCompileError(
    `type One = 1; type Box = { value: One; }; function main(): i32 { return 0; }`,
    "Literal-only type alias 'One' cannot be used as a value type",
  );
  assertCompileError(
    `type A = A; function main(): i32 { return 0; }`,
    "Type alias cycle involving 'A'",
  );
  assertCompileError(
    `type A = B; type B = A; function main(): i32 { return 0; }`,
    "Type alias cycle involving 'A'",
  );
});

Deno.test("checks 0.1 generic completion rules", () => {
  const source = `
    function id<T>(value: T): T { return value; }
    function main(): i32 {
      const a: i32 = id<i32>(1);
      const b: i32 = id<i32>(2);
      return a + b;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  if (c.indexOf("id_i32") !== c.lastIndexOf("id_i32")) {
    assertIncludes(c, "id_i32");
  }
  assertCompileError(
    `function loop<T>(value: T): i32 { return loop<i32>(1); } function main(): i32 { return loop<i32>(1); }`,
    "Recursive generic instantiation cycle involving function 'loop'",
  );
  assertCompileError(
    `type Box<T> = { value: Box<T> }; function main(): i32 { const value: Box<i32> = { value: { value: 0 } }; return 0; }`,
    "Recursive generic instantiation cycle involving type alias 'Box'",
  );
  assertCompileError(
    `class Box<T> { value: Box<T>; } function main(): i32 { const value: Box<i32> = new Box<i32>(); return 0; }`,
    "Recursive generic instantiation cycle involving class 'Box'",
  );
  assertCompileError(
    `function keep<T extends i32>(value: T): T { return value; } function main(): i32 { return keep<u32>(1 as u32); }`,
    "Generic function 'keep' type parameter 'T' with type 'u32' does not satisfy i32",
  );
  assertCompileError(
    `class Box<T extends i32> { value: T; } function main(): i32 { const value: Box<u32> = new Box<u32>(); return 0; }`,
    "Generic class 'Box' type parameter 'T' with type 'u32' does not satisfy i32",
  );
  assertCompileError(
    `type Box<T extends i32> = { value: T }; function main(): i32 { const value: Box<u32> = { value: 1 as u32 }; return 0; }`,
    "Generic type alias 'Box' type parameter 'T' with type 'u32' does not satisfy i32",
  );
});

Deno.test("checks 0.1 control-flow and narrowing rules", () => {
  assertCheckSucceeds(
    `union MaybeI32 { Some: i32; None; } function read(value: MaybeI32): i32 { if (value.tag == MaybeI32.Some) { return value.Some; } return 0; }`,
  );
  assertCheckSucceeds(
    `union MaybeI32 { Some: i32; None; } function read(value: MaybeI32): i32 { switch (value.tag) { case MaybeI32.Some: return value.Some; case MaybeI32.None: return 0; } return 0; }`,
  );
  assertCompileError(
    `function main(): i32 { return 1; const x: i32 = 2; }`,
    "Unreachable statement",
  );
  assertCompileError(
    `function main(): i32 { if (true) { return 1; } else { return 2; } return 3; }`,
    "Unreachable statement",
  );
  assertCompileError(
    `function main(): i32 { if (true) { return 1; } }`,
    "Function 'main' must return 'i32'",
  );
  assertCompileError(
    `union MaybeI32 { Some: i32; None; } function read(value: MaybeI32): i32 { return value.Some; }`,
    "Union value 'value' payload 'Some' requires tag narrowing",
  );
  assertCompileError(
    `union MaybeI32 { Some: i32; Other: i32; } function read(value: MaybeI32): i32 { if (value.tag == MaybeI32.Some) { return value.Other; } return 0; }`,
    "Union value 'value' is narrowed to 'Some'",
  );
});

Deno.test("checks 0.1 interface and borrowed view rules", async () => {
  const source = `
    interface Readable {
      get(): i32;
      add(value: i32): i32;
    }
    class Box implements Readable {
      value: i32;
      get(): i32 { return this.value; }
      add(value: i32): i32 { return this.value + value; }
    }
    function consume(readable: Readable&): i32 {
      return readable.get() + readable.add(2);
    }
    function main(): i32 {
      let box: Box = { value: 40 };
      const readable: Readable& = box.&;
      return consume(readable);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct Readable {");
  assertIncludes(c, "  void* self;");
  assertIncludes(c, "  i32 (*get)(void*)");
  assertIncludes(c, "  i32 (*add)(void*, i32)");
  assertIncludes(c, "static i32 Box_as_Readable_get(void* self)");
  assertIncludes(c, "static i32 Box_as_Readable_add(void* self, i32 value)");
  assertIncludes(
    c,
    "const Readable readable = (Readable){ .self = &box, .get = Box_as_Readable_get, .add = Box_as_Readable_add };",
  );
  assertIncludes(c, "readable.get(readable.self) + readable.add(readable.self, 2)");
  assertNotIncludes(c, "malloc");

  assertCompileError(
    `interface Readable { get(): i32; } function use(value: Readable): i32 { return 0; } function main(): i32 { return 0; }`,
    "Interface value type 'Readable' is not implemented",
  );
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } function main(): i32 { let empty: Empty = { value: 1 }; const readable: Readable& = empty.&; return 0; }`,
    "Cannot borrow 'Empty' as interface 'Readable': missing method 'get'",
  );
  assertCompileError(
    `interface Readable { get(): i32; } class Bad { get(value: i32): i32 { return value; } } function main(): i32 { let bad: Bad = {}; const readable: Readable& = bad.&; return 0; }`,
    "Cannot borrow 'Bad' as interface 'Readable': method 'get' signature does not match",
  );
  assertCompileError(
    `interface Readable { get(): i32; } class Bad implements Readable { get(value: i32): i32 { return value; } } function main(): i32 { return 0; }`,
    "Type 'Bad' does not satisfy 'Readable': method 'get' signature does not match",
  );
  assertCompileError(
    `interface Readable { get(): i32; get(): i32; } function main(): i32 { return 0; }`,
    "Duplicate interface method 'get'",
  );

  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/main.tc`, source);
  const result = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  assertIncludes(result.cSource, "Box_as_Readable_get");
});

Deno.test("checks 0.1 class static layout and dispatch rules", async () => {
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
      shifted(dx: i32): i32 { return this.x + this.hp + dx; }
    }
    class MathUtil {
      static abs(value: i32): i32 { return value; }
    }
    function main(): i32 {
      const ship: Ship = new Ship(1, 2);
      return ship.shifted(3) + MathUtil.abs(4);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertInOrder(c, "} Entity;", "  i32 x;", "  i32 hp;", "} Ship;");
  assertIncludes(c, "static Ship Ship_new(i32 x, i32 hp)");
  assertIncludes(c, "Ship this = (Ship){0};");
  assertIncludes(c, "this.x = x;");
  assertIncludes(c, "this.hp = hp;");
  assertIncludes(c, "static i32 Ship_shifted(Ship* this, i32 dx)");
  assertIncludes(c, "return this->x + this->hp + dx;");
  assertIncludes(c, "static i32 MathUtil_abs(i32 value)");
  assertIncludes(c, "return Ship_shifted(&ship, 3) + MathUtil_abs(4);");
  assertNotIncludes(c, "super");

  assertCompileError(
    `class A { x: i32; get(): i32 { return super.get(); } } function main(): i32 { return 0; }`,
    "Unknown identifier 'super'",
  );
  assertCompileError(
    `class Ship extends Missing { hp: i32; } function main(): i32 { return 0; }`,
    "Unknown base class 'Missing'",
  );
  assertCompileError(
    `class A extends B { a: i32; } class B extends A { b: i32; } function main(): i32 { return 0; }`,
    "Inheritance cycle involving 'A'",
  );
  assertCompileError(
    `class Point { x: i32; constructor(x: i32) { this.x = x; } } function main(): i32 { const p: Point = new Point(); return 0; }`,
    "Function 'Point.constructor' expects 1 arguments, got 0",
  );

  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/main.tc`, source);
  const result = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  assertIncludes(result.cSource, "static i32 Ship_shifted(Ship* this, i32 dx)");
});

Deno.test("checks 0.1 record struct and static object shape rules", async () => {
  const source = `
    type Meta = { readonly id: i32; tag?: u8*; };
    type Point = { x: i32; y: i32; meta: Meta; };
    struct Size { width: i32; height: i32; }
    function area(size: Size): i32 { return size.width * size.height; }
    function main(): i32 {
      const base: Point = { x: 1, y: 2, meta: { id: 7 } };
      const moved: Point = { ...base, y: 4 };
      const { x, ...rest } = moved;
      const size: Size = { width: rest.y, height: moved.meta.id };
      return x + area(size);
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertInOrder(c, "typedef struct {", "  i32 id;", "  Optional_u8_ tag;", "} Meta;");
  assertInOrder(c, "} Meta;", "  i32 x;", "  i32 y;", "  Meta meta;", "} Point;");
  assertIncludes(c, "typedef struct Size {");
  assertInOrder(c, "typedef struct Size", "  i32 width;", "  i32 height;");
  assertIncludes(c, ".tag = (Optional_u8_");
  assertIncludes(c, "const Point moved = (Point){ .x = base.x, .y = 4, .meta = base.meta };");
  assertIncludes(c, "const i32 x = moved.x;");
  assertIncludes(c, ".y = moved.y");

  assertCompileError(
    `type Point = { x: i32; }; function main(): i32 { const p: Point = { x: 1, y: 2 }; return 0; }`,
    "Unknown field 'y' on type 'Point'",
  );
  assertCompileError(
    `type Point = { x: i32; y: i32; }; function main(): i32 { const p: Point = { x: 1 }; return 0; }`,
    "Missing field 'y' on type 'Point'",
  );
  assertCompileError(
    `type Point = { readonly x: i32; }; function main(): i32 { let p: Point = { x: 1 }; p.x = 2; return 0; }`,
    "Field 'x' is readonly",
  );
  assertCompileError(
    `type Point = { x: i32; }; function main(): i32 { const p: Point = { x: 1 }; return p.y; }`,
    "Unknown field 'y' on type 'Point'",
  );

  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(`${dir}/main.tc`, source);
  const result = await compileFile(`${dir}/main.tc`, `${dir}/build`);
  assertIncludes(result.cSource, "typedef struct Size {");
});

Deno.test("checks 0.1 memory construction and misuse rules", () => {
  assertCheckSucceeds(
    `function first(values: Slice<i32>): i32 { return values[0]; } function main(): i32 { let x: i32 = 7; let p: Ptr<i32> = x.&; p.* = 8; const r: Ref<i32> = x.&; const s: SafePtr<i32> = x.&; const values: Array<i32, 2> = [r.*, s.*]; return first(values); }`,
  );
  assertCheckSucceeds(
    `function main(): i32 { const arena: Arena = arenaCreate(); const value: SafePtr<i32> = arenaAlloc(arena, 1); arenaDestroy(arena); return 0; }`,
  );
  assertCompileError(
    `function main(): i32 { const x: i32 = 1; return x.*; }`,
    "Cannot dereference non-pointer-like type 'i32'",
  );
  assertCompileError(
    `function main(): i32 { const x: Ref<void> = 0.&; return 0; }`,
    "Reference type cannot target void type",
  );
  assertCompileError(
    `function main(): i32 { const value: i32 = 1; const p: Ptr<i32> = value; return 0; }`,
    "Initializer type 'i32' is not assignable to 'i32*'",
  );
  assertCompileError(
    `function main(): i32 { const values: Slice<i32> = 1; return 0; }`,
    "Initializer type 'i32' is not assignable to 'Slice<i32>'",
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

Deno.test("emits C for explicitly backed enums", () => {
  const source =
    `enum Color: u8 { Red = 1, Green = 2 } function main(): i32 { const color: Color = Color.Green; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "typedef u8 Color;");
  assertIncludes(c, "static const Color Color_Red = 1;");
  assertIncludes(c, "static const Color Color_Green = 2;");
});

Deno.test("rejects enum members outside backing range", () => {
  assertCompileError(
    `enum Small: u8 { TooLarge = 256 } function main(): i32 { return 0; }`,
    "Enum member value '256' is out of range for 'u8'",
  );
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
    "Interface value type 'Drawable' is not implemented",
  );
});

Deno.test("accepts borrowed interface type syntax without emitting dispatch", () => {
  assertCheckSucceeds(
    `interface Readable { get(): i32; } function use(value: Readable&): void { return; } function main(): i32 { return 0; }`,
  );
  assertCheckSucceeds(
    `interface Readable { get(): i32; } function use(value: Ref<Readable>): void { return; } function main(): i32 { return 0; }`,
  );
  assertCompileError(
    `interface Readable { get(): i32; } function use(value: Readable): void { return; } function main(): i32 { return 0; }`,
    "Interface value type 'Readable' is not implemented",
  );
});

Deno.test("checks borrowed interface conversions without emitting dispatch", () => {
  assertCheckSucceeds(
    `interface Readable { get(): i32; } class Box implements Readable { get(): i32 { return 1; } } function use(value: Readable&): void { return; } function main(): i32 { let box: Box = {}; use(box.&); return 0; }`,
  );
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } function use(value: Readable&): void { return; } function main(): i32 { let empty: Empty = { value: 1 }; use(empty.&); return 0; }`,
    "Cannot borrow 'Empty' as interface 'Readable': missing method 'get'",
  );
});

Deno.test("emits C for borrowed interface method calls", () => {
  const source = `
    interface Readable { get(): i32; }
    class Box implements Readable { get(): i32 { return 1; } }
    function main(): i32 {
      let box: Box = {};
      const readable: Readable& = box.&;
      return readable.get();
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct Readable");
  assertIncludes(c, "static i32 Box_as_Readable_get(void* self)");
  assertIncludes(
    c,
    "const Readable readable = (Readable){ .self = &box, .get = Box_as_Readable_get };",
  );
  assertIncludes(c, "return readable.get(readable.self);");
});

Deno.test("compiles constrained generic example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/generic_constraint.tc", dir);

  assertIncludes(result.cSource, "read_Box");
  assertIncludes(result.cSource, "Holder_Box_get");
});

Deno.test("checks generic function record shape constraints", () => {
  const source = `
    type Item = { id: i32; };
    function read<T extends { id: i32; }>(value: T): i32 { return value.id; }
    function main(): i32 {
      const item: Item = { id: 7 };
      return read<Item>(item);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 read_Item(Item value)");
  assertIncludes(c, "return value.id;");
});

Deno.test("rejects unsatisfied generic function record shape constraints", () => {
  assertCompileError(
    `type Named = { name: i32; }; function read<T extends { id: i32; }>(value: T): i32 { return 0; } function main(): i32 { const value: Named = { name: 7 }; return read<Named>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Named' is missing required field 'id' for record constraint",
  );
});

Deno.test("rejects mismatched generic function record shape constraints", () => {
  assertCompileError(
    `type Item = { id: u32; }; function read<T extends { id: i32; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { id: 7 }; return read<Item>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Item' has field 'id' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("rejects optional generic function record constraint fields", () => {
  assertCompileError(
    `type Item = { id?: i32; }; function read<T extends { id: i32; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { id: 7 }; return read<Item>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Item' has optional field 'id' but record constraint requires it",
  );
});

Deno.test("rejects readonly generic function record constraint fields", () => {
  assertCompileError(
    `type Item = { readonly id: i32; }; function read<T extends { id: i32; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { id: 7 }; return read<Item>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Item' has readonly field 'id' but record constraint requires a mutable field",
  );
});

Deno.test("checks nested generic function record shape constraints", () => {
  const source = `
    type Meta = { id: i32; tag: i32; };
    type Item = { meta: Meta; };
    function read<T extends { meta: { id: i32; }; }>(value: T): i32 { return value.meta.id; }
    function main(): i32 {
      const item: Item = { meta: { id: 7, tag: 1 } };
      return read<Item>(item);
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 read_Item(Item value)");
  assertIncludes(c, "return value.meta.id;");
});

Deno.test("rejects nested generic function record shape constraint fields", () => {
  assertCompileError(
    `type Meta = { tag: i32; }; type Item = { meta: Meta; }; function read<T extends { meta: { id: i32; }; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { meta: { tag: 7 } }; return read<Item>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint",
  );
});

Deno.test("rejects nested mismatched generic function record shape constraint fields", () => {
  assertCompileError(
    `type Meta = { id: u32; }; type Item = { meta: Meta; }; function read<T extends { meta: { id: i32; }; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { meta: { id: 7 } }; return read<Item>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Item' has field 'meta.id' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("reports multiple generic function record shape constraint fields", () => {
  assertCompileDiagnostics(
    `type Item = { name: i32; }; function read<T extends { id: i32; count: i32; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { name: 7 }; return read<Item>(value); }`,
    [
      "Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'id' for record constraint",
      "Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'count' for record constraint",
    ],
  );
});

Deno.test("reports multiple nested generic function record shape constraint fields", () => {
  assertCompileDiagnostics(
    `type Meta = { tag: i32; }; type Item = { meta: Meta; }; function read<T extends { meta: { id: i32; count: i32; }; }>(value: T): i32 { return 0; } function main(): i32 { const value: Item = { meta: { tag: 7 } }; return read<Item>(value); }`,
    [
      "Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint",
      "Generic function 'read' type parameter 'T' with type 'Item' is missing required field 'meta.count' for record constraint",
    ],
  );
});

Deno.test("rejects unsatisfied generic function constraints", () => {
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } function read<T extends Readable>(value: T): i32 { return 0; } function main(): i32 { const value: Empty = { value: 1 }; return read<Empty>(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Empty' does not satisfy interface 'Readable': missing method 'get'",
  );
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } function read<T extends Readable>(value: T): i32 { return 0; } function main(): i32 { const value: Empty = { value: 1 }; return read(value); }`,
    "Generic function 'read' type parameter 'T' with type 'Empty' does not satisfy interface 'Readable': missing method 'get'",
  );
});

Deno.test("rejects unsatisfied generic class constraints", () => {
  assertCompileError(
    `interface Readable { get(): i32; } class Empty { value: i32; } class Holder<T extends Readable> { value: T; } function main(): i32 { const empty: Empty = { value: 1 }; const holder: Holder<Empty> = { value: empty }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Empty' does not satisfy interface 'Readable': missing method 'get'",
  );
});

Deno.test("checks generic class record shape constraints", () => {
  const source = `
    type Item = { id: i32; };
    class Holder<T extends { id: i32; }> { value: T; }
    function main(): i32 {
      const item: Item = { id: 7 };
      const holder: Holder<Item> = { value: item };
      return holder.value.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Holder_Item;");
  assertIncludes(c, "Item value;");
});

Deno.test("rejects unsatisfied generic class record shape constraints", () => {
  assertCompileError(
    `type Named = { name: i32; }; class Holder<T extends { id: i32; }> { value: T; } function main(): i32 { const value: Named = { name: 7 }; const holder: Holder<Named> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Named' is missing required field 'id' for record constraint",
  );
});

Deno.test("rejects mismatched generic class record shape constraints", () => {
  assertCompileError(
    `type Item = { id: u32; }; class Holder<T extends { id: i32; }> { value: T; } function main(): i32 { const value: Item = { id: 7 }; const holder: Holder<Item> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Item' has field 'id' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("rejects optional generic class record constraint fields", () => {
  assertCompileError(
    `type Item = { id?: i32; }; class Holder<T extends { id: i32; }> { value: T; } function main(): i32 { const value: Item = { id: 7 }; const holder: Holder<Item> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Item' has optional field 'id' but record constraint requires it",
  );
});

Deno.test("rejects readonly generic class record constraint fields", () => {
  assertCompileError(
    `type Item = { readonly id: i32; }; class Holder<T extends { id: i32; }> { value: T; } function main(): i32 { const value: Item = { id: 7 }; const holder: Holder<Item> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Item' has readonly field 'id' but record constraint requires a mutable field",
  );
});

Deno.test("checks nested generic class record shape constraints", () => {
  const source = `
    type Meta = { id: i32; tag: i32; };
    type Item = { meta: Meta; };
    class Holder<T extends { meta: { id: i32; }; }> { value: T; }
    function main(): i32 {
      const item: Item = { meta: { id: 7, tag: 1 } };
      const holder: Holder<Item> = { value: item };
      return holder.value.meta.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Holder_Item;");
  assertIncludes(c, "Item value;");
});

Deno.test("rejects nested generic class record shape constraint fields", () => {
  assertCompileError(
    `type Meta = { tag: i32; }; type Item = { meta: Meta; }; class Holder<T extends { meta: { id: i32; }; }> { value: T; } function main(): i32 { const value: Item = { meta: { tag: 7 } }; const holder: Holder<Item> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint",
  );
});

Deno.test("rejects nested mismatched generic class record shape constraint fields", () => {
  assertCompileError(
    `type Meta = { id: u32; }; type Item = { meta: Meta; }; class Holder<T extends { meta: { id: i32; }; }> { value: T; } function main(): i32 { const value: Item = { meta: { id: 7 } }; const holder: Holder<Item> = { value }; return 0; }`,
    "Generic class 'Holder' type parameter 'T' with type 'Item' has field 'meta.id' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("reports multiple generic class record shape constraint fields", () => {
  assertCompileDiagnostics(
    `type Item = { name: i32; }; class Holder<T extends { id: i32; count: i32; }> { value: T; } function main(): i32 { const value: Item = { name: 7 }; const holder: Holder<Item> = { value }; return 0; }`,
    [
      "Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'id' for record constraint",
      "Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'count' for record constraint",
    ],
  );
});

Deno.test("reports multiple nested generic class record shape constraint fields", () => {
  assertCompileDiagnostics(
    `type Meta = { tag: i32; }; type Item = { meta: Meta; }; class Holder<T extends { meta: { id: i32; count: i32; }; }> { value: T; } function main(): i32 { const value: Item = { meta: { tag: 7 } }; const holder: Holder<Item> = { value }; return 0; }`,
    [
      "Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.id' for record constraint",
      "Generic class 'Holder' type parameter 'T' with type 'Item' is missing required field 'meta.count' for record constraint",
    ],
  );
});

Deno.test("checks exact literal-constrained generic classes", () => {
  const source = `
    class Holder<T extends 1> { value: i32; }
    function main(): i32 {
      const holder: Holder<1> = { value: 7 };
      return holder.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Holder_1;");
  assertIncludes(c, "i32 value;");
});

Deno.test("rejects unsatisfied exact literal-constrained generic classes", () => {
  assertCompileError(
    `class Holder<T extends 1> { value: i32; } function main(): i32 { const holder: Holder<2> = { value: 7 }; return holder.value; }`,
    "Generic class 'Holder' type parameter 'T' with type '2' does not satisfy 1",
  );
});

Deno.test("rejects unknown constrained generic function type arguments", () => {
  assertCompileError(
    `interface Readable { get(): i32; } function read<T extends Readable>(value: T): i32 { return 0; } function main(): i32 { return read<Missing>({}); }`,
    "Unknown type 'Missing'",
  );
});

Deno.test("rejects invalid explicit generic function type arguments without cascades", () => {
  assertCompileDiagnostics(
    `function id<T>(value: T): T { return value; } function main(): i32 { return id<Missing>(0); }`,
    ["Unknown type 'Missing'"],
  );
  assertCompileDiagnostics(
    `interface Readable { get(): i32; } function id<T>(value: T): T { return value; } function main(): i32 { return id<Readable>({}); }`,
    ["Interface value type 'Readable' is not implemented"],
  );
});

Deno.test("accepts enum explicit generic function type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `enum Key: i32 { A = 1 } function id<T>(value: T): T { return value; } function main(): i32 { const k: Key = Key.A; const x: Key = id<Key>(k); return 0; }`,
  ))))));
  assertIncludes(c, "id_Key");
});

Deno.test("accepts tagged union explicit generic function type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `union Value { I: i32; } function id<T>(value: T): T { return value; } function main(): i32 { const v: Value = Value.I(1); const x: Value = id<Value>(v); return 0; }`,
  ))))));
  assertIncludes(c, "id_Value");
});

Deno.test("accepts struct explicit generic function type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `struct Point { x: i32; } function id<T>(value: T): T { return value; } function main(): i32 { const p: Point = { x: 1 }; const x: Point = id<Point>(p); return x.x; }`,
  ))))));
  assertIncludes(c, "id_Point");
});

Deno.test("accepts class explicit generic function type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `class Box { value: i32; } function id<T>(value: T): T { return value; } function main(): i32 { const b: Box = { value: 1 }; const x: Box = id<Box>(b); return x.value; }`,
  ))))));
  assertIncludes(c, "id_Box");
});

Deno.test("accepts type alias explicit generic function type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `type Point = { x: i32; }; function id<T>(value: T): T { return value; } function main(): i32 { const p: Point = { x: 1 }; const x: Point = id<Point>(p); return x.x; }`,
  ))))));
  assertIncludes(c, "id_Point");
});

Deno.test("rejects invalid generic function constraint declarations", () => {
  assertCompileError(
    `function read<T extends Missing>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Unknown type 'Missing'",
  );
  assertCompileError(
    `type Count = i32; function read<T extends Count>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic constraint 'Count' must be an interface",
  );
  assertCompileError(
    `class Box { value: i32; } function read<T extends Box>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic constraint 'Box' must be an interface",
  );
  assertCompileError(
    `struct Point { x: i32; } function read<T extends Point>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic constraint 'Point' must be an interface",
  );
  assertCompileError(
    `enum Key: i32 { A = 1 } function read<T extends Key>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic constraint 'Key' must be an interface",
  );
  assertCompileError(
    `union Value { I32: i32; } function read<T extends Value>(value: T): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic constraint 'Value' must be an interface",
  );
});

Deno.test("rejects unknown constrained generic class type arguments", () => {
  assertCompileError(
    `interface Readable { get(): i32; } class Holder<T extends Readable> { value: T; } function main(): i32 { const holder: Holder<Missing> = {}; return 0; }`,
    "Unknown type 'Missing'",
  );
});

Deno.test("rejects invalid explicit generic class type arguments without cascades", () => {
  assertCompileDiagnostics(
    `class Holder<T> { value: T; } function main(): i32 { const h: Holder<Missing> = {}; return 0; }`,
    ["Unknown type 'Missing'"],
  );
  assertCompileDiagnostics(
    `interface Readable { get(): i32; } class Holder<T> { value: T; } function main(): i32 { const h: Holder<Readable> = {}; return 0; }`,
    ["Interface value type 'Readable' is not implemented"],
  );
});

Deno.test("accepts enum explicit generic class type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `enum Key: i32 { A = 1 } class Holder<T> { value: T; } function main(): i32 { const h: Holder<Key> = { value: Key.A }; return 0; }`,
  ))))));
  assertIncludes(c, "Holder_Key");
});

Deno.test("accepts tagged union explicit generic class type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `union Value { I: i32; } class Holder<T> { value: T; } function main(): i32 { const h: Holder<Value> = { value: Value.I(1) }; return 0; }`,
  ))))));
  assertIncludes(c, "Holder_Value");
});

Deno.test("accepts struct explicit generic class type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `struct Point { x: i32; } class Holder<T> { value: T; } function main(): i32 { const h: Holder<Point> = { value: { x: 1 } }; return h.value.x; }`,
  ))))));
  assertIncludes(c, "Holder_Point");
});

Deno.test("accepts class explicit generic class type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `class Box { value: i32; } class Holder<T> { value: T; } function main(): i32 { const b: Box = { value: 1 }; const h: Holder<Box> = { value: b }; return h.value.value; }`,
  ))))));
  assertIncludes(c, "Holder_Box");
});

Deno.test("accepts type alias explicit generic class type arguments", () => {
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(
    `type Point = { x: i32; }; class Holder<T> { value: T; } function main(): i32 { const h: Holder<Point> = { value: { x: 1 } }; return h.value.x; }`,
  ))))));
  assertIncludes(c, "Holder_Point");
});

Deno.test("rejects invalid generic class constraint declarations", () => {
  assertCompileError(
    `class Holder<T extends Missing> { value: T; } function main(): i32 { return 0; }`,
    "Unknown type 'Missing'",
  );
  assertCompileError(
    `class Holder<T extends i32*> { value: T; } function main(): i32 { return 0; }`,
    "Generic constraint for 'T' must be an interface",
  );
});

Deno.test("rejects constrained interface type arguments", () => {
  assertCompileError(
    `interface Readable { get(): i32; } function read<T extends Readable>(value: T): i32 { return 0; } function main(): i32 { return read<Readable>({}); }`,
    "Interface value type 'Readable' is not implemented",
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
  assertIncludes(c, "return Box_i32_get(&box);");
});

Deno.test("emits C for generic classes with named generic field types", () => {
  const source = `
    class Box<T> {
      value: Optional<T>;
      constructor(value: Optional<T>) { this.value = value; }
      get(): Optional<T> { return this.value; }
    }
    function main(): i32 {
      const box = new Box<i32>(Some(7));
      const value: i32? = box.get();
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Optional_i32 value;");
  assertIncludes(c, "static Box_i32 Box_i32_new(Optional_i32 value)");
  assertIncludes(c, "static Optional_i32 Box_i32_get(Box_i32* this)");
  assertIncludes(c, "const Optional_i32 value = Box_i32_get(&box);");
});

Deno.test("emits C for generic class new expressions inferred from named type arguments", () => {
  const source = `
    class Box<T> {
      value: Optional<T>;
      constructor(value: Optional<T>) { this.value = value; }
      get(): Optional<T> { return this.value; }
    }
    function main(): i32 {
      const maybe: i32? = Some(7);
      const box = new Box(maybe);
      const value: i32? = box.get();
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Box_i32 Box_i32_new(Optional_i32 value)");
  assertIncludes(c, "const Box_i32 box = Box_i32_new(maybe);");
  assertIncludes(c, "const Optional_i32 value = Box_i32_get(&box);");
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
  assertIncludes(c, "Ship_shifted(&ship, 3)");
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
  assertIncludes(c, "static f64 Vec2_lengthSquared(Vec2* this)");
  assertIncludes(c, "this->x * this->x + this->y * this->y");
  assertIncludes(c, "const f64 d = Vec2_lengthSquared(&v);");
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
  assertIncludes(c, "Vec2_lengthSquared(&v)");
});

Deno.test("compiles class example", async () => {
  const dir = await Deno.makeTempDir();
  const result = await compileFile("examples/class.tc", dir);

  assertIncludes(result.cSource, "static f64 Vec2_lengthSquared(Vec2* this)");
  assertIncludes(result.cSource, "Vec2_lengthSquared(&v)");
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

Deno.test("emits C for namespace function constant dependencies", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/math.tc`,
    `const FACTOR: i32 = 2; export const USED: i32 = FACTOR; export const UNUSED: i32 = 9; export function scale(value: i32): i32 { return value * FACTOR; } export function unused(): i32 { return UNUSED; }`,
  );
  await Deno.writeTextFile(
    `${dir}/main.tc`,
    `import * as Math from "./math.tc"; function main(): i32 { return Math.scale(Math.USED); }`,
  );

  const c = emitC(check(resolve(await loadProgram(`${dir}/main.tc`))));

  assertIncludes(c, "static const i32 Math_FACTOR = 2;");
  assertIncludes(c, "static const i32 Math_USED = 2;");
  assertIncludes(c, "return value * Math_FACTOR;");
  assertIncludes(c, "return Math_scale(Math_USED);");
  assertNotIncludes(c, "Math_UNUSED");
  assertNotIncludes(c, "Math_unused");
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
    `import * as Lib from "./lib.h"; function main(): i32 { const title: u8* = Lib.TITLE; return 42; }`,
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

Deno.test("emits C for array and slice helper slicing", () => {
  const source =
    `function first(values: Slice<i32>): i32 { return values[0]; } function main(): i32 { const values: Array<i32, 4> = [10, 20, 30, 40]; const middle: Slice<i32> = values.slice(1, 3); const tail: Slice<i32> = middle.slice(1, middle.length()); return first(tail); }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const Slice_i32 middle = (Slice_i32){ .data = values + 1, .length = 3 - 1 };");
  assertIncludes(
    c,
    "const Slice_i32 tail = (Slice_i32){ .data = middle.data + 1, .length = middle.length - 1 };",
  );
});

Deno.test("rejects invalid static array slicing", () => {
  assertCompileError(
    `function main(): i32 { const values: Array<i32, 2> = [1, 2]; const bad: Slice<i32> = values.slice(0, 3); return 0; }`,
    "slice end 3 is out of bounds for length 2",
  );
  assertCompileError(
    `function main(): i32 { const values: Array<i32, 2> = [1, 2]; const bad: Slice<i32> = values.slice(2, 1); return 0; }`,
    "slice start must be less than or equal to end",
  );
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

Deno.test("emits C for optional record fields", () => {
  const source =
    `type User = { id: i32; name?: u8*; }; function read(user: User): u8*? { return user.name; } function main(): i32 { const a: User = { id: 1 }; const b: User = { id: 2, name: "Ada" }; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));
  assertIncludes(c, "typedef struct Optional_u8_");
  assertIncludes(c, "Optional_u8_ name;");
  assertIncludes(c, ".name = (Optional_u8_){ .present = false }");
  assertIncludes(c, '.name = (Optional_u8_){ .present = true, .value = (u8*)"Ada" }');
  assertIncludes(c, "return user.name;");
});

Deno.test("emits C for inferred optional constructors in record fields", () => {
  const source =
    `type User = { id: i32; name?: u8*; }; function main(): i32 { const a: User = { id: 1, name: Some("Ada") }; const b: User = { id: 2, name: None() }; return 0; }`;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, '.name = (Optional_u8_){ .present = true, .value = (u8*)"Ada" }');
  assertIncludes(c, ".name = (Optional_u8_){ .present = false }");
});

Deno.test("checks optional record field payload types", () => {
  assertCompileError(
    `type User = { id: i32; name?: u8*; }; function main(): i32 { const user: User = { id: 1, name: 42 }; return 0; }`,
    "Field 'name' type 'i32' is not assignable to 'u8*'",
  );
});

Deno.test("checks aggregate record literal field diagnostics", () => {
  assertCompileError(
    `type User = { id: i32; }; function main(): i32 { const user: User = { id: 1, name: 2 }; return 0; }`,
    "Unknown field 'name' on type 'User'",
  );
  assertCompileError(
    `function main(): i32 { const value = Some(1); return 0; }`,
    "Some requires an expected optional type or exactly one explicit type argument",
  );
});

Deno.test("still requires non-optional record fields", () => {
  assertCompileError(
    `type User = { id: i32; name?: u8*; }; function main(): i32 { const user: User = { name: "Ada" }; return 0; }`,
    "Missing field 'id' on type 'User'",
  );
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

Deno.test("emits C for generic calls inferred from type alias arguments", () => {
  const source = `
    type Point = { x: i32; };
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const point: Point = { x: 1 };
      const value: Point = identity(point);
      return value.x;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "identity_Point");
});

Deno.test("emits C for generic type aliases", () => {
  const source = `
    type Box<T> = { value: T; };
    function main(): i32 {
      const box: Box<i32> = { value: 1 };
      return box.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Box_i32;");
  assertIncludes(c, "const Box_i32 box = (Box_i32){ .value = 1 };");
  assertIncludes(c, "return box.value;");
});

Deno.test("emits C for nested generic type aliases", () => {
  const source = `
    type Box<T> = { value: T; };
    type Holder<T> = { box: Box<T>; };
    function main(): i32 {
      const holder: Holder<i32> = { box: { value: 1 } };
      return holder.box.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Box_i32;");
  assertIncludes(c, "Box_i32 box;");
  assertIncludes(c, "} Holder_i32;");
  assertIncludes(c, "const Holder_i32 holder = (Holder_i32){ .box = (Box_i32){ .value = 1 } };");
});

Deno.test("emits C for constrained generic type aliases", () => {
  const source = `
    interface Readable { get(): i32; }
    class Box implements Readable { get(): i32 { return 1; } }
    type Holder<T extends Readable> = { flag: bool; };
    function main(): i32 {
      const holder: Holder<Box> = { flag: true };
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Holder_Box;");
  assertIncludes(c, "const Holder_Box holder = (Holder_Box){ .flag = true };");
});

Deno.test("rejects unsatisfied constrained generic type aliases", () => {
  assertCompileError(
    `interface Readable { get(): i32; } type Holder<T extends Readable> = { flag: bool; }; function main(): i32 { const holder: Holder<i32> = { flag: true }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'i32' does not satisfy Readable",
  );
});

Deno.test("emits C for record-constrained generic type aliases", () => {
  const source = `
    type Point = { id: i32; x: i32; };
    type Holder<T extends { id: i32 }> = { value: T; };
    function main(): i32 {
      const holder: Holder<Point> = { value: { id: 1, x: 2 } };
      return holder.value.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Point value;");
  assertIncludes(c, "} Holder_Point;");
  assertIncludes(c, "return holder.value.id;");
});

Deno.test("rejects missing record-constrained generic type alias fields", () => {
  assertCompileError(
    `type Point = { x: i32; }; type Holder<T extends { id: i32 }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { x: 1 } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'id' for record constraint",
  );
});

Deno.test("rejects mismatched record-constrained generic type alias fields", () => {
  assertCompileError(
    `type Point = { id: u32; }; type Holder<T extends { id: i32 }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { id: 1 } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' has field 'id' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("accepts absent optional record-constrained generic type alias fields", () => {
  const source = `
    type Point = { x: i32; };
    type Holder<T extends { id?: i32 }> = { value: T; };
    function main(): i32 {
      const holder: Holder<Point> = { value: { x: 1 } };
      return holder.value.x;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Point value;");
  assertIncludes(c, "} Holder_Point;");
});

Deno.test("rejects optional fields for required record-constrained generic type alias fields", () => {
  assertCompileError(
    `type Point = { id?: i32; }; type Holder<T extends { id: i32 }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: {} }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' has optional field 'id' but record constraint requires it",
  );
});

Deno.test("accepts mutable fields for readonly record-constrained generic type alias fields", () => {
  const source = `
    type Point = { id: i32; };
    type Holder<T extends { readonly id: i32 }> = { value: T; };
    function main(): i32 {
      const holder: Holder<Point> = { value: { id: 1 } };
      return holder.value.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Point value;");
  assertIncludes(c, "} Holder_Point;");
});

Deno.test("rejects readonly fields for mutable record-constrained generic type alias fields", () => {
  assertCompileError(
    `type Point = { readonly id: i32; }; type Holder<T extends { id: i32 }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { id: 1 } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' has readonly field 'id' but record constraint requires a mutable field",
  );
});

Deno.test("accepts nested record-constrained generic type alias fields", () => {
  const source = `
    type Meta = { id: i32; tag: i32; };
    type Point = { meta: Meta; x: i32; };
    type Holder<T extends { meta: { id: i32 } }> = { value: T; };
    function main(): i32 {
      const holder: Holder<Point> = { value: { meta: { id: 1, tag: 2 }, x: 3 } };
      return holder.value.meta.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Point value;");
  assertIncludes(c, "} Holder_Point;");
});

Deno.test("rejects nested record-constrained generic type alias fields", () => {
  assertCompileError(
    `type Meta = { tag: i32; }; type Point = { meta: Meta; }; type Holder<T extends { meta: { id: i32 } }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { meta: { tag: 1 } } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.id' for record constraint",
  );
});

Deno.test("reports nested readonly record-constrained generic type alias field paths", () => {
  assertCompileError(
    `type Meta = { readonly id: i32; }; type Point = { meta: Meta; }; type Holder<T extends { meta: { id: i32 } }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { meta: { id: 1 } } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' has readonly field 'meta.id' but record constraint requires a mutable field",
  );
});

Deno.test("reports multiple record-constrained generic type alias fields", () => {
  assertCompileDiagnostics(
    `type Point = { name: i32; }; type Holder<T extends { id: i32; count: i32; }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { name: 1 } }; return 0; }`,
    [
      "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'id' for record constraint",
      "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'count' for record constraint",
    ],
  );
});

Deno.test("reports multiple nested record-constrained generic type alias fields", () => {
  assertCompileDiagnostics(
    `type Meta = { tag: i32; }; type Point = { meta: Meta; }; type Holder<T extends { meta: { id: i32; count: i32; } }> = { value: T; }; function main(): i32 { const holder: Holder<Point> = { value: { meta: { tag: 1 } } }; return 0; }`,
    [
      "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.id' for record constraint",
      "Generic type alias 'Holder' type parameter 'T' with type 'Point' is missing required field 'meta.count' for record constraint",
    ],
  );
});

Deno.test("emits C for exact primitive-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends i32> = { value: T; };
    function main(): i32 {
      const holder: Holder<i32> = { value: 1 };
      return holder.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 value;");
  assertIncludes(c, "} Holder_i32;");
});

Deno.test("rejects unsatisfied exact primitive-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends i32> = { value: T; }; function main(): i32 { const holder: Holder<u32> = { value: 1 }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'u32' does not satisfy i32",
  );
});

Deno.test("emits C for exact enum-constrained generic type aliases", () => {
  const source = `
    enum Key: i32 { A = 1 }
    type Holder<T extends Key> = { value: T; };
    function take(value: Holder<Key>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const enumIndex = c.indexOf("typedef i32 Key;");
  const holderIndex = c.indexOf("} Holder_Key;");

  if (enumIndex < 0 || holderIndex < 0 || enumIndex > holderIndex) {
    throw new Error("Expected enum typedef before generic alias instantiation");
  }
  assertIncludes(c, "Key value;");
});

Deno.test("rejects unsatisfied exact enum-constrained generic type aliases", () => {
  assertCompileError(
    `enum Key: i32 { A = 1 } enum Other: i32 { A = 1 } type Holder<T extends Key> = { value: T; }; function take(value: Holder<Other>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Other' does not satisfy Key",
  );
});

Deno.test("emits C for exact struct-constrained generic type aliases", () => {
  const source = `
    struct Point { x: i32; }
    type Holder<T extends Point> = { value: T; };
    function take(value: Holder<Point>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const pointIndex = c.indexOf("} Point;");
  const holderIndex = c.indexOf("} Holder_Point;");

  if (pointIndex < 0 || holderIndex < 0 || pointIndex > holderIndex) {
    throw new Error("Expected struct typedef before generic alias instantiation");
  }
  assertIncludes(c, "Point value;");
});

Deno.test("rejects unsatisfied exact struct-constrained generic type aliases", () => {
  assertCompileError(
    `struct Point { x: i32; } struct Other { x: i32; } type Holder<T extends Point> = { value: T; }; function take(value: Holder<Other>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Other' does not satisfy Point",
  );
});

Deno.test("emits C for exact class-constrained generic type aliases", () => {
  const source = `
    class Point {
      x: i32;
      constructor(x: i32) { this.x = x; }
    }
    type Holder<T extends Point> = { value: T; };
    function take(value: Holder<Point>): i32 { return value.value.x; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const pointIndex = c.indexOf("} Point;");
  const holderIndex = c.indexOf("} Holder_Point;");

  if (pointIndex < 0 || holderIndex < 0 || pointIndex > holderIndex) {
    throw new Error("Expected class record typedef before generic alias instantiation");
  }
  assertIncludes(c, "Point value;");
});

Deno.test("rejects unsatisfied exact class-constrained generic type aliases", () => {
  assertCompileError(
    `class Point { x: i32; constructor(x: i32) { this.x = x; } } class Other { x: i32; constructor(x: i32) { this.x = x; } } type Holder<T extends Point> = { value: T; }; function take(value: Holder<Other>): i32 { return value.value.x; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Other' does not satisfy Point",
  );
});

Deno.test("emits C for exact generic-class-constrained generic type aliases", () => {
  const source = `
    class Box<T> {
      value: T;
      constructor(value: T) { this.value = value; }
    }
    type Holder<T extends Box<i32>> = { value: T; };
    function take(value: Holder<Box<i32>>): i32 { return value.value.value; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const holderIndex = c.indexOf("} Holder_Box_i32;");

  if (boxIndex < 0 || holderIndex < 0 || boxIndex > holderIndex) {
    throw new Error("Expected generic class record typedef before generic alias instantiation");
  }
  assertIncludes(c, "Box_i32 value;");
});

Deno.test("rejects unsatisfied exact generic-class-constrained generic type aliases", () => {
  assertCompileError(
    `class Box<T> { value: T; constructor(value: T) { this.value = value; } } type Holder<T extends Box<i32>> = { value: T; }; function take(value: Holder<Box<u32>>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Box_u32' does not satisfy Box_i32",
  );
});

Deno.test("emits C for exact tagged-union-constrained generic type aliases", () => {
  const source = `
    union Result { Ok: i32; Err: i32; }
    type Holder<T extends Result> = { value: T; };
    function take(value: Holder<Result>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const unionIndex = c.indexOf("} Result;");
  const holderIndex = c.indexOf("} Holder_Result;");

  if (unionIndex < 0 || holderIndex < 0 || unionIndex > holderIndex) {
    throw new Error("Expected tagged union typedef before generic alias instantiation");
  }
  assertIncludes(c, "Result value;");
});

Deno.test("rejects unsatisfied exact tagged-union-constrained generic type aliases", () => {
  assertCompileError(
    `union Result { Ok: i32; Err: i32; } union Other { Ok: i32; Err: i32; } type Holder<T extends Result> = { value: T; }; function take(value: Holder<Other>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Other' does not satisfy Result",
  );
});

Deno.test("emits C for exact alias-constrained generic type aliases", () => {
  const source = `
    type Point = { id: i32; };
    type Holder<T extends Point> = { value: T; };
    function main(): i32 {
      const holder: Holder<Point> = { value: { id: 1 } };
      return holder.value.id;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Point value;");
  assertIncludes(c, "} Holder_Point;");
});

Deno.test("emits C for exact generic-alias-constrained generic type aliases", () => {
  const source = `
    type Box<T> = { value: T; };
    type Holder<T extends Box<i32>> = { value: T; };
    function main(): i32 {
      const holder: Holder<Box<i32>> = { value: { value: 1 } };
      return holder.value.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Box_i32;");
  assertIncludes(c, "Box_i32 value;");
  assertIncludes(c, "} Holder_Box_i32;");
});

Deno.test("rejects unsatisfied exact generic-alias-constrained generic type aliases", () => {
  assertCompileError(
    `type Box<T> = { value: T; }; type Holder<T extends Box<i32>> = { value: T; }; function main(): i32 { const holder: Holder<Box<u32>> = { value: { value: 1 } }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Box_u32' does not satisfy Box<i32>",
  );
});

Deno.test("emits C for exact fixed-array-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends i32[2]> = { value: T; };
    function main(): i32 {
      const holder: Holder<i32[2]> = { value: [1, 2] };
      return holder.value[0];
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 value[2];");
  assertIncludes(c, "} Holder_i32_2;");
});

Deno.test("rejects unsatisfied exact fixed-array-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends i32[2]> = { value: T; }; function main(): i32 { const holder: Holder<i32[3]> = { value: [1, 2, 3] }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'i32[3]' does not satisfy i32[2]",
  );
});

Deno.test("emits C for exact tuple-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends [i32, u32]> = { value: T; };
    function main(): i32 {
      const holder: Holder<[i32, u32]> = { value: [1, 2] };
      return holder.value[0];
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Tuple_i32_u32 value;");
  assertIncludes(c, "} Holder_i32_u32;");
});

Deno.test("rejects unsatisfied exact tuple-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends [i32, u32]> = { value: T; }; function main(): i32 { const holder: Holder<[i32, i32]> = { value: [1, 2] }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type '[i32, i32]' does not satisfy [i32, u32]",
  );
});

Deno.test("emits C for exact optional-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends i32?> = { value: T; };
    function main(): i32 {
      const holder: Holder<i32?> = { value: Some(1) };
      return holder.value!;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "Optional_i32 value;");
  assertIncludes(c, "} Holder_i32;");
});

Deno.test("rejects unsatisfied exact optional-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends i32?> = { value: T; }; function main(): i32 { const holder: Holder<u32?> = { value: Some(1) }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'u32?' does not satisfy i32?",
  );
});

Deno.test("emits C for exact pointer-like-constrained generic type aliases", () => {
  const source = `
    type PtrHolder<T extends i32*> = { value: T; };
    type RefHolder<T extends i32&> = { value: T; };
    type SafeHolder<T extends SafePtr<i32>> = { value: T; };
    type SliceHolder<T extends Slice<i32>> = { value: T; };
    function a(value: PtrHolder<i32*>): i32 { return 0; }
    function b(value: RefHolder<i32&>): i32 { return 0; }
    function c(value: SafeHolder<SafePtr<i32>>): i32 { return 0; }
    function d(value: SliceHolder<Slice<i32>>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32* value;");
  assertIncludes(c, "} PtrHolder_i32;");
  assertIncludes(c, "} RefHolder_i32;");
  assertIncludes(c, "} SafeHolder_SafePtr_i32;");
  assertIncludes(c, "Slice_i32 value;");
  assertIncludes(c, "} SliceHolder_Slice_i32;");
});

Deno.test("rejects unsatisfied exact pointer-like-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends i32*> = { value: T; }; function take(value: Holder<u32*>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'u32*' does not satisfy i32*",
  );
});

Deno.test("emits C for exact function-type-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends (value: i32) => i32> = { value: T; };
    function take(value: Holder<(input: i32) => i32>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 (*value)(i32);");
  assertIncludes(c, "} Holder_input_i32_i32;");
});

Deno.test("rejects unsatisfied exact function-type-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends (value: i32) => i32> = { value: T; }; function take(value: Holder<(value: u32) => i32>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type '(value: u32) => i32' does not satisfy (value: i32) => i32",
  );
});

Deno.test("emits C for nested exact generic type alias constraints in generic type aliases", () => {
  const source = `
    type Holder<T extends (value: i32*) => i32*> = { value: T; };
    function take(value: Holder<(input: i32*) => i32*>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32* (*value)(i32*);");
  assertIncludes(c, "} Holder_input_i32_i32;");
});

Deno.test("rejects unsatisfied nested exact generic type alias constraints in generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends (value: i32*) => i32*> = { value: T; }; function take(value: Holder<(value: u32*) => i32*>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type '(value: u32*) => i32*' does not satisfy (value: i32*) => i32*",
  );
});

Deno.test("emits tuple dependencies before generated generic type aliases", () => {
  const source = `
    type Holder<T> = { value: T; };
    function take(value: Holder<[i32, u32]>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const tupleIndex = c.indexOf("} Tuple_i32_u32;");
  const holderIndex = c.indexOf("} Holder_i32_u32;");

  if (tupleIndex < 0 || holderIndex < 0 || tupleIndex > holderIndex) {
    throw new Error("Expected tuple typedef before generated generic alias");
  }
  assertIncludes(c, "Tuple_i32_u32 value;");
});

Deno.test("emits slice dependencies before generated generic type aliases", () => {
  const source = `
    type Holder<T> = { value: T; };
    function take(value: Holder<Slice<i32>>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const sliceIndex = c.indexOf("} Slice_i32;");
  const holderIndex = c.indexOf("} Holder_Slice_i32;");

  if (sliceIndex < 0 || holderIndex < 0 || sliceIndex > holderIndex) {
    throw new Error("Expected slice typedef before generated generic alias");
  }
  assertIncludes(c, "Slice_i32 value;");
});

Deno.test("emits record dependencies before generated generic type aliases", () => {
  const source = `
    type Holder<T> = { value: T; };
    function take(value: Holder<{ x: i32 }>): i32 { return value.value.x; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const recordIndex = c.indexOf("} Record__x7b_x_x3a_i32_x7d_;");
  const holderIndex = c.indexOf("} Holder_x_i32;");

  if (recordIndex < 0 || holderIndex < 0 || recordIndex > holderIndex) {
    throw new Error("Expected record typedef before generated generic alias");
  }
  assertIncludes(c, "Record__x7b_x_x3a_i32_x7d_ value;");
});

Deno.test("emits optional dependencies before generated generic type aliases", () => {
  const source = `
    type Holder<T> = { value: T; };
    function take(value: Holder<{ x: i32 }?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const optionalIndex = c.indexOf("} Optional__x_i32_;");
  const holderIndex = c.indexOf("} Holder_x_i32;");

  if (optionalIndex < 0 || holderIndex < 0 || optionalIndex > holderIndex) {
    throw new Error("Expected optional typedef before generated generic alias");
  }
  assertIncludes(c, "Optional__x_i32_ value;");
});

Deno.test("emits tuple dependencies before optional generated generic alias fields", () => {
  const source = `
    type Holder<T> = { value: T; };
    function take(value: Holder<[i32, u32]?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const tupleIndex = c.indexOf("} Tuple_i32_u32;");
  const optionalIndex = c.indexOf("} Optional__i32__u32_;");
  const holderIndex = c.indexOf("} Holder_i32_u32;");

  if (tupleIndex < 0 || optionalIndex < 0 || holderIndex < 0) {
    throw new Error("Expected tuple, optional, and generated alias typedefs");
  }
  if (tupleIndex > optionalIndex || optionalIndex > holderIndex) {
    throw new Error("Expected tuple before optional before generated generic alias");
  }
  assertIncludes(c, "Optional__i32__u32_ value;");
});

Deno.test("emits generated generic alias dependencies before optional alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<Box<i32>?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const optionalIndex = c.indexOf("} Optional_Box_i32;");
  const holderIndex = c.indexOf("} Holder_Box_i32;");

  if (boxIndex < 0 || optionalIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, optional, and dependent alias typedefs");
  }
  if (boxIndex > optionalIndex || optionalIndex > holderIndex) {
    throw new Error("Expected generated alias before optional before dependent alias");
  }
  assertIncludes(c, "Optional_Box_i32 value;");
});

Deno.test("emits generated optional dependencies before tuple alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<[Box<i32>?, i32]>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const optionalIndex = c.indexOf("} Optional_Box_i32;");
  const tupleIndex = c.indexOf("} Tuple_Box_x5f_i32_x3f__i32;");
  const holderIndex = c.indexOf("} Holder_Box_i32_i32;");

  if (boxIndex < 0 || optionalIndex < 0 || tupleIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, optional, tuple, and dependent alias typedefs");
  }
  if (boxIndex > optionalIndex || optionalIndex > tupleIndex || tupleIndex > holderIndex) {
    throw new Error("Expected generated alias before optional before tuple before dependent alias");
  }
  assertIncludes(c, "Tuple_Box_x5f_i32_x3f__i32 value;");
});

Deno.test("emits generated optional dependencies before slice alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<Slice<Box<i32>?>>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const optionalIndex = c.indexOf("} Optional_Box_i32;");
  const sliceIndex = c.indexOf("} Slice_Box_i32_;");
  const holderIndex = c.indexOf("} Holder_Slice_Box_i32;");

  if (boxIndex < 0 || optionalIndex < 0 || sliceIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, optional, slice, and dependent alias typedefs");
  }
  if (boxIndex > optionalIndex || optionalIndex > sliceIndex || sliceIndex > holderIndex) {
    throw new Error("Expected generated alias before optional before slice before dependent alias");
  }
  assertIncludes(c, "Slice_Box_i32_ value;");
});

Deno.test("emits generated optional dependencies before record alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<{ x: Box<i32>? }>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const optionalIndex = c.indexOf("} Optional_Box_i32;");
  const recordIndex = c.indexOf("} Record__x7b_x_x3a_Box_x5f_i32_x3f__x7d_;");
  const holderIndex = c.indexOf("} Holder_x_Box_i32;");

  if (boxIndex < 0 || optionalIndex < 0 || recordIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, optional, record, and dependent alias typedefs");
  }
  if (boxIndex > optionalIndex || optionalIndex > recordIndex || recordIndex > holderIndex) {
    throw new Error(
      "Expected generated alias before optional before record before dependent alias",
    );
  }
  assertIncludes(c, "Record__x7b_x_x3a_Box_x5f_i32_x3f__x7d_ value;");
});

Deno.test("emits generated optional record dependencies before optional alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<{ x: Box<i32>? }?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const boxOptionalIndex = c.indexOf("} Optional_Box_i32;");
  const recordIndex = c.indexOf("} Record__x7b_x_x3a_Box_x5f_i32_x3f__x7d_;");
  const recordOptionalIndex = c.indexOf("} Optional__x_Box_i32__;");
  const holderIndex = c.indexOf("} Holder_x_Box_i32;");

  if (
    boxIndex < 0 || boxOptionalIndex < 0 || recordIndex < 0 ||
    recordOptionalIndex < 0 || holderIndex < 0
  ) {
    throw new Error("Expected generated alias, optionals, record, and dependent alias typedefs");
  }
  if (
    boxIndex > boxOptionalIndex || boxOptionalIndex > recordIndex ||
    recordIndex > recordOptionalIndex || recordOptionalIndex > holderIndex
  ) {
    throw new Error("Expected generated alias before nested optional record dependency chain");
  }
  assertIncludes(c, "Optional__x_Box_i32__ value;");
});

Deno.test("rejects optional fixed arrays before C emission", () => {
  assertCompileError(
    `type Box<T> = { item: T; }; type Holder<T> = { value: T; }; function take(value: Holder<Box<i32>[2]?>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Optional type cannot contain array type",
  );
});

Deno.test("checks exact literal-constrained generic functions", () => {
  const source = `
    function keep<T extends 1>(value: i32): i32 { return value; }
    function main(): i32 { return keep<1>(7); }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 keep_1(i32 value)");
  assertIncludes(c, "return keep_1(7);");
});

Deno.test("rejects unsatisfied exact literal-constrained generic functions", () => {
  assertCompileError(
    `function keep<T extends 1>(value: i32): i32 { return value; } function main(): i32 { return keep<2>(7); }`,
    "Generic function 'keep' type parameter 'T' with type '2' does not satisfy 1",
  );
});

Deno.test("checks exact primitive-constrained generic functions", () => {
  const source = `
    function keep<T extends i32>(value: T): T { return value; }
    function main(): i32 { return keep<i32>(7); }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 keep_i32(i32 value)");
  assertIncludes(c, "return keep_i32(7);");
});

Deno.test("rejects unsatisfied exact primitive-constrained generic functions", () => {
  assertCompileError(
    `function keep<T extends i32>(value: T): T { return value; } function main(): i32 { return keep<u32>(7); }`,
    "Generic function 'keep' type parameter 'T' with type 'u32' does not satisfy i32",
  );
});

Deno.test("checks generic type alias record shape constraints with structs", () => {
  const source = `
    struct Point { x: i32; }
    type Holder<T extends { x: i32; }> = { value: T; };
    function main(): i32 {
      const point: Point = { x: 7 };
      const holder: Holder<Point> = { value: point };
      return holder.value.x;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "} Holder_Point;");
  assertIncludes(c, "Point value;");
});

Deno.test("rejects mismatched generic type alias record shape constraints with structs", () => {
  assertCompileError(
    `struct Point { x: u32; } type Holder<T extends { x: i32; }> = { value: T; }; function main(): i32 { const point: Point = { x: 7 }; const holder: Holder<Point> = { value: point }; return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type 'Point' has field 'x' of type 'u32' but record constraint requires 'i32'",
  );
});

Deno.test("checks exact literal-constrained generic type aliases", () => {
  const source = `
    type Holder<T extends 1> = { value: i32; };
    function take(value: Holder<1>): i32 { return value.value; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef struct Holder_1 {");
  assertIncludes(c, "i32 value;");
});

Deno.test("rejects unsatisfied exact literal-constrained generic type aliases", () => {
  assertCompileError(
    `type Holder<T extends 1> = { value: i32; }; function take(value: Holder<2>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Generic type alias 'Holder' type parameter 'T' with type '2' does not satisfy 1",
  );
});

Deno.test("rejects literal fields in runtime type aliases before C emission", () => {
  assertCompileError(
    `type R = { x: 1; }; function take(value: R): i32 { return 0; } function main(): i32 { return 0; }`,
    "Literal type cannot be used as a value type",
  );
  assertCompileError(
    `type One = 1; type R = { x: One; }; function take(value: R): i32 { return 0; } function main(): i32 { return 0; }`,
    "Literal-only type alias 'One' cannot be used as a value type",
  );
});

Deno.test("rejects literal value types before C emission", () => {
  assertCompileError(
    `function take(value: 1): i32 { return 0; } function main(): i32 { return 0; }`,
    "Literal type cannot be used as a value type",
  );
  assertCompileError(
    `type One = 1; function take(value: One): i32 { return 0; } function main(): i32 { return 0; }`,
    "Literal-only type alias 'One' cannot be used as a value type",
  );
});

Deno.test("rejects optional function types before C emission", () => {
  assertCompileError(
    `type Holder<T> = { value: T; }; function take(value: Holder<((value: i32) => i32)?>): i32 { return 0; } function main(): i32 { return 0; }`,
    "Optional type cannot contain function type",
  );
});

Deno.test("emits generated record dependencies before optional alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<{ x: Box<i32> }?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const recordIndex = c.indexOf("} Record__x7b_x_x3a_Box_x5f_i32_x7d_;");
  const optionalIndex = c.indexOf("} Optional__x_Box_i32_;");
  const holderIndex = c.indexOf("} Holder_x_Box_i32;");

  if (boxIndex < 0 || recordIndex < 0 || optionalIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, record, optional, and dependent alias typedefs");
  }
  if (boxIndex > recordIndex || recordIndex > optionalIndex || optionalIndex > holderIndex) {
    throw new Error(
      "Expected generated alias before record before optional before dependent alias",
    );
  }
});

Deno.test("emits generated tuple dependencies before optional alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<[Box<i32>]?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const tupleIndex = c.indexOf("} Tuple_Box_x5f_i32;");
  const optionalIndex = c.indexOf("} Optional__Box_i32_;");
  const holderIndex = c.indexOf("} Holder_Box_i32;");

  if (boxIndex < 0 || tupleIndex < 0 || optionalIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, tuple, optional, and dependent alias typedefs");
  }
  if (boxIndex > tupleIndex || tupleIndex > optionalIndex || optionalIndex > holderIndex) {
    throw new Error("Expected generated alias before tuple before optional before dependent alias");
  }
});

Deno.test("emits generated slice dependencies before optional alias fields", () => {
  const source = `
    type Box<T> = { item: T; };
    type Holder<T> = { value: T; };
    function take(value: Holder<Slice<Box<i32>>?>): i32 { return 0; }
    function main(): i32 { return 0; }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  const boxIndex = c.indexOf("} Box_i32;");
  const sliceIndex = c.indexOf("} Slice_Box_i32;");
  const optionalIndex = c.indexOf("} Optional_Slice_Box_i32_;");
  const holderIndex = c.indexOf("} Holder_Slice_Box_i32;");

  if (boxIndex < 0 || sliceIndex < 0 || optionalIndex < 0 || holderIndex < 0) {
    throw new Error("Expected generated alias, slice, optional, and dependent alias typedefs");
  }
  if (boxIndex > sliceIndex || sliceIndex > optionalIndex || optionalIndex > holderIndex) {
    throw new Error("Expected generated alias before slice before optional before dependent alias");
  }
});

Deno.test("emits C for generic calls inferred from enum arguments", () => {
  const source = `
    enum Key: i32 { A = 1 }
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const key: Key = Key.A;
      const value: Key = identity(key);
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "identity_Key");
});

Deno.test("emits C for generic calls inferred from struct arguments", () => {
  const source = `
    struct Point { x: i32; }
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const point: Point = { x: 1 };
      const result: Point = identity(point);
      return result.x;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "identity_Point");
});

Deno.test("emits C for generic calls inferred from class arguments", () => {
  const source = `
    class Box { value: i32; }
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const box: Box = { value: 1 };
      const result: Box = identity(box);
      return result.value;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "identity_Box");
});

Deno.test("emits C for generic calls inferred from tagged union arguments", () => {
  const source = `
    union Value { I: i32; }
    function identity<T>(value: T): T {
      return value;
    }
    function main(): i32 {
      const value: Value = Value.I(1);
      const result: Value = identity(value);
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "identity_Value");
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

Deno.test("emits C for generic calls inferred from named type arguments", () => {
  const source = `
    function keep<T>(value: Optional<T>): Optional<T> {
      return value;
    }
    function main(): i32 {
      const maybe: i32? = Some(7);
      const value: i32? = keep(maybe);
      return 0;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static Optional_i32 keep_i32(Optional_i32 value);");
  assertIncludes(c, "const Optional_i32 value = keep_i32(maybe);");
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

  assertIncludes(c, "return Sink_consume(&sink, produce_i32());");
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
    "Some requires an expected optional type or exactly one explicit type argument",
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

Deno.test("emits C for static class members", () => {
  const source = `
    class MathUtil {
      static zero: i32 = 0;
      static abs(value: i32): i32 {
        return value < 0 ? -value : value;
      }
    }
    function main(): i32 {
      return MathUtil.abs(-1) + MathUtil.zero;
    }
  `;
  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static const i32 MathUtil_zero = 0;");
  assertIncludes(c, "static i32 MathUtil_abs(i32 value)");
  assertIncludes(c, "return MathUtil_abs(-1) + MathUtil_zero;");
});

Deno.test("emits C for namespace declarations", () => {
  const source = `
    namespace Math {
      export const zero: i32 = 0;
      export function abs(value: i32): i32 {
        return value < 0 ? -value : value;
      }
    }
    function main(): i32 {
      return Math.abs(-1) + Math.zero;
    }
  `;
  const c = emitC(check(resolve(parse(lex(source)))));

  assertIncludes(c, "const i32 Math_zero = 0;");
  assertIncludes(c, "i32 Math_abs(i32 value)");
  assertIncludes(c, "return Math_abs(-1) + Math_zero;");
});

Deno.test("emits C for keyof and type-position typeof", () => {
  const source = `
    type Point = { x: i32, y: i32 };
    type Keys = keyof Point;
    const value: i32 = 1;
    type ValueType = typeof value;
    function main(): i32 { return value; }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "typedef i32 ValueType;");
  assertNotIncludes(c, "Keys_");
});

Deno.test("emits C for satisfies expressions without runtime operator", () => {
  const source = `
    type Point = { x: i32 };
    const value: i32 = 1 satisfies i32;
    const point: Point = { x: 1 } satisfies Point;
    function main(): i32 { return value + point.x; }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static const i32 value = 1;");
  assertIncludes(c, "static const Point point = (Point){ .x = 1 };");
  assertNotIncludes(c, "satisfies");
});

Deno.test("rejects unsatisfied satisfies expressions", () => {
  assertCompileError(
    `const value: i32 = 1; function main(): i32 { return value satisfies u8; }`,
    "Type 'i32' does not satisfy 'u8'",
  );
});

Deno.test("accepts literal-only type aliases without runtime emission", () => {
  const source = `
    type Mode = "read" | "write";
    function main(): i32 { return 0; }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertNotIncludes(c, "typedef struct Mode");
  assertNotIncludes(c, "Mode_");
});

Deno.test("infers module const types from literals", () => {
  const source = `
    const answer = 42;
    const flag = true;
    function main(): i32 { return answer; }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static const i32 answer = 42;");
  assertIncludes(c, "static const b8 flag = true;");
});

Deno.test("checks 0.1 primitive operation and cast rules", () => {
  assertCheckSucceeds(
    `function main(): i32 { const x: i32 = 1 + 2 * 3 - 4 / 2; const y: i32 = (7 % 3) | 4; const z: i32 = y & 7; return x + z; }`,
  );
  assertCheckSucceeds(
    `function main(): i32 { const a: bool = 1 < 2; const b: bool = true && !false; return a && b ? 1 : 0; }`,
  );
  assertCheckSucceeds(
    `function main(): i32 { const x: i32 = 8; const shift: usize = 1; const y: i32 = x << shift; return y; }`,
  );
  assertCheckSucceeds(
    `function main(): i32 { const x: i32 = @i32(1.5); const y: f32 = 2 as f32; return x; }`,
  );
  assertCompileError(
    `function main(): i32 { const x: i32 = 1.0; return x; }`,
    "Initializer type 'f64' is not assignable to 'i32'",
  );
  assertCompileError(
    `function main(): i32 { const x: i32 = @i32(true); return x; }`,
    "Cannot cast 'bool' to 'i32'",
  );
  assertCompileError(
    `function main(): i32 { const x: i8 = 128; return 0; }`,
    "Integer literal '128' is out of range for 'i8'",
  );
  assertCompileError(
    `function main(): i32 { const x: i32 = 1 & 2.0; return x; }`,
    "Cannot apply '&' to 'i32' and 'f64'",
  );
});

Deno.test("checks 0.1 local initialization rules", () => {
  assertCompileError(
    `function main(): i32 { const x: i32; return x; }`,
    "Expected '='",
  );
  assertCompileError(
    `function main(): i32 { let x: i32; return x; }`,
    "Expected '='",
  );
  assertCheckSucceeds(
    `function id(value: i32): i32 { return value; } function main(): i32 { return id(1); }`,
  );
});

Deno.test("checks 0.1 aggregate initialization rules", () => {
  assertCompileError(
    `type Point = { x: i32; y: i32; }; function main(): i32 { const p: Point = { x: 1 }; return p.x; }`,
    "Missing field 'y' on type 'Point'",
  );
  assertCompileError(
    `function main(): i32 { const values: i32[3] = [1, 2]; return 0; }`,
    "Array length 2 is not assignable to 'i32[3]'",
  );
  assertCompileError(
    `function main(): i32 { const pair: [i32, i32] = [1]; return 0; }`,
    "Tuple literal length 1 does not match expected length 2",
  );
});

Deno.test("checks 0.1 assignment and lvalue rules", () => {
  assertCompileError(
    `function main(): i32 { const x: i32 = 1; x = 2; return x; }`,
    "Cannot assign to const 'x'",
  );
  assertCompileError(
    `function main(): i32 { const values: i32[2] = [1, 2]; values = [3, 4]; return values[0]; }`,
    "Cannot assign to const 'values'",
  );
  assertCompileError(
    `function main(): i32 { let values: i32[2] = [1, 2]; values = [3, 4]; return values[0]; }`,
    "Cannot assign to array variable 'values'",
  );
  assertCompileError(
    `function main(): i32 { let x: i32 = 1; (x + 1) = 2; return x; }`,
    "Invalid assignment target",
  );
  assertCompileError(
    `function main(): i32 { let x: i32 = 1; (x + 1)++; return x; }`,
    "Invalid assignment target",
  );
  assertCheckSucceeds(
    `function main(): i32 { let value: i32 = 1; let pointer: i32* = value.&; pointer.* = 7; return value; }`,
  );
});

Deno.test("checks class private and readonly fields", () => {
  assertCompileError(
    `class Counter { private value: i32; get(): i32 { return this.value; } } function main(): i32 { let c: Counter = { value: 1 }; return c.value; }`,
    "Field 'value' is private",
  );
  assertCompileError(
    `class Counter { readonly value: i32; } function main(): i32 { let c: Counter = { value: 1 }; c.value = 2; return c.value; }`,
    "Field 'value' is readonly",
  );
  assertCompileError(
    `class Counter { private get(): i32 { return 1; } } function main(): i32 { let c: Counter = {}; return c.get(); }`,
    "Method 'get' is private",
  );
  assertCompileError(
    `type Point = { readonly x: i32, y: i32 }; function main(): i32 { let p: Point = { x: 1, y: 2 }; p.x = 3; return p.y; }`,
    "Field 'x' is readonly",
  );
  assertCompileError(
    `type Point = {
      readonly x: i32,
      y: i32
    }; function main(): i32 { let p: Point = { x: 1, y: 2 }; p.x = 3; return p.y; }`,
    "Field 'x' is readonly",
  );
  assertCompileError(
    `type Point = { readonly x: i32, y: i32 }; function identity<T>(value: T): T { return value; } function main(): i32 { let p: Point = { x: 1, y: 2 }; let q: Point = identity(p); q.x = 3; return q.y; }`,
    "Field 'x' is readonly",
  );
  assertCompileError(
    `class MathUtil { static abs(value: i32): i32 { return value; } } function main(): i32 { let m: MathUtil = {}; return m.abs(1); }`,
    "Static method 'abs' requires class access",
  );
});

Deno.test("emits C for function-typed local calls", () => {
  const source = `
    function inc(value: i32): i32 { return value + 1; }
    function main(): i32 {
      const callback: (value: i32) => i32 = inc;
      return callback(41);
    }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "i32 (*callback)(i32) = inc;");
  assertIncludes(c, "return callback(41);");
});

Deno.test("emits C for function-typed parameter calls", () => {
  const source = `
    function inc(value: i32): i32 { return value + 1; }
    function apply(callback: (value: i32) => i32, value: i32): i32 {
      return callback(value);
    }
    function main(): i32 { return apply(inc, 41); }
  `;

  const c = emitC(check(resolve(instantiateGenerics(parse(lex(source))))));

  assertIncludes(c, "static i32 apply(i32 (*callback)(i32), i32 value)");
  assertIncludes(c, "return callback(value);");
});

Deno.test("checks function-typed local call arguments", () => {
  assertCompileError(
    `
      function inc(value: i32): i32 { return value + 1; }
      function main(): i32 {
        const callback: (value: i32) => i32 = inc;
        return callback(true);
      }
    `,
    "Argument 1 type 'bool' is not assignable to 'i32'",
  );
});

Deno.test("rejects calls to non-function locals", () => {
  assertCompileError(
    `function main(): i32 { const value: i32 = 1; return value(); }`,
    "Value 'value' of type 'i32' is not callable",
  );
});

Deno.test("rejects function-typed local call arity mismatches", () => {
  assertCompileError(
    `
      function make(): i32 { return 1; }
      function main(): i32 {
        const callback: () => i32 = make;
        return callback(1);
      }
    `,
    "Function 'callback' expects 0 arguments, got 1",
  );
});

function assertCheckSucceeds(source: Str): void {
  check(resolve(instantiateGenerics(parse(lex(source)))));
}

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

function assertCompileDiagnostics(source: Str, expected: Str[]): void {
  try {
    emitC(check(resolve(instantiateGenerics(parse(lex(source))))));
  } catch (error) {
    if (!(error instanceof TypeCError)) throw error;
    assertEqualText(
      error.diagnostics.map((diagnostic) => diagnostic.message),
      expected,
    );
    return;
  }
  throw new Error(`Expected diagnostics ${expected.join(", ")}`);
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
