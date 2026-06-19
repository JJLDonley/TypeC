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

Deno.test("checks record literals and field access", () => {
  check(resolve(parse(lex(`type Vec2 = { x: f64; y: f64; }; function getX(v: Vec2): f64 { return v.x; } function main(): i32 { const v: Vec2 = { x: 1.5, y: 2.5 }; return 0; }`))));
});

Deno.test("rejects duplicate record type fields", () => {
  assertCheckError(`type Vec2 = { x: f64; x: f64; }; function main(): i32 { return 0; }`, "Duplicate field 'x'");
});

Deno.test("rejects missing record fields", () => {
  assertCheckError(`type Vec2 = { x: f64; y: f64; }; function main(): i32 { const v: Vec2 = { x: 1.5 }; return 0; }`, "Missing field 'y' on type 'Vec2'");
});

Deno.test("rejects unknown record fields", () => {
  assertCheckError(`type Vec2 = { x: f64; y: f64; }; function main(): i32 { const v: Vec2 = { x: 1.5, y: 2.5, z: 3.5 }; return 0; }`, "Unknown field 'z' on type 'Vec2'");
});

Deno.test("rejects duplicate record literal fields", () => {
  assertCheckError(`type Vec2 = { x: f64; y: f64; }; function main(): i32 { const v: Vec2 = { x: 1.5, x: 2.5, y: 3.5 }; return 0; }`, "Duplicate field 'x'");
});

Deno.test("rejects unknown field access", () => {
  assertCheckError(`type Vec2 = { x: f64; y: f64; }; function main(): f64 { const v: Vec2 = { x: 1.5, y: 2.5 }; return v.z; }`, "Unknown field 'z' on type 'Vec2'");
});

Deno.test("checks inferred array literals and indexing", () => {
  check(resolve(parse(lex(`function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[0]; }`))));
});

Deno.test("rejects array element mismatch", () => {
  assertCheckError(`function main(): i32 { const xs: i32[] = [1, 2.5]; return 0; }`, "Array element type 'f64' is not assignable to 'i32'");
});

Deno.test("rejects fixed array length mismatch", () => {
  assertCheckError(`function main(): i32 { const xs: i32[2] = [1, 2, 3]; return 0; }`, "Array length 3 is not assignable to 'i32[2]'");
});

Deno.test("rejects array return types", () => {
  assertCheckError(`function values(): i32[3] { return [1, 2, 3]; } function main(): i32 { return 0; }`, "Function 'values' cannot return array type 'i32[3]'");
});

Deno.test("checks while and assignment", () => {
  check(resolve(parse(lex(`function main(): i32 { let x: i32 = 0; while (x < 3) { x = x + 1; } return x; }`))));
});

Deno.test("rejects assignment to const", () => {
  assertCheckError(`function main(): i32 { const x: i32 = 0; x = 1; return x; }`, "Cannot assign to const 'x'");
});

Deno.test("rejects non-bool while conditions", () => {
  assertCheckError(`function main(): i32 { while (1) { return 0; } return 0; }`, "While condition type 'i32' is not assignable to 'bool'");
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
