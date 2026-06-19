import { check } from "checker";
import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { resolve } from "core/resolver.ts";

type Str = string;

Deno.test("checks extern function calls", () => {
  check(resolve(parse(lex(`extern function add(a: i32, b: i32): i32; function main(): i32 { return add(20, 22); }`))));
});

Deno.test("rejects invalid main signatures", () => {
  assertCheckError(`function main(argc: i32): i32 { return argc; }`, "Function 'main' cannot have parameters");
  assertCheckError(`function main(): void { return; }`, "Function 'main' must return 'i32'");
  assertCheckError(`extern function main(): i32;`, "Function 'main' cannot be extern");
});

Deno.test("rejects non-C ABI extern parameter types", () => {
  assertCheckError(`extern function use_ref(x: i32&): void; function main(): i32 { return 0; }`, "Extern function 'use_ref' parameter 'x' type 'i32&' is not C ABI compatible");
});

Deno.test("rejects extern array return types", () => {
  assertCheckError(`extern function values(): i32[3]; function main(): i32 { return 0; }`, "Function 'values' cannot return array type 'i32[3]'");
});

Deno.test("rejects non-C ABI exported parameter types", () => {
  assertCheckError(`export function bad(x: i32&): void { return 0; } function main(): i32 { return 0; }`, "Exported function 'bad' parameter 'x' type 'i32&' is not C ABI compatible");
});

Deno.test("checks exported record aliases as C ABI types", () => {
  check(resolve(parse(lex(`type Vec2 = { x: f64; y: f64; }; export function len(v: Vec2): f64 { return v.x + v.y; } function main(): i32 { return 0; }`))));
});

Deno.test("checks exported fixed-array record fields as C ABI types", () => {
  check(resolve(parse(lex(`type Block = { values: i32[3]; }; export function use_block(b: Block): i32 { return b.values[0]; } function main(): i32 { return 0; }`))));
});

Deno.test("rejects non-record type aliases", () => {
  assertCheckError(`type Count = i32; function main(): i32 { return 0; }`, "Type alias 'Count' must name a record type");
});

Deno.test("rejects record aliases that depend on undeclared aliases", () => {
  assertCheckError(`type A = { b: B; }; type B = { x: i32; }; function main(): i32 { return 0; }`, "Type alias 'A' cannot depend on 'B' before it is declared");
});

Deno.test("rejects recursive record aliases", () => {
  assertCheckError(`type Node = { next: Node*; }; function main(): i32 { return 0; }`, "Type alias 'Node' cannot depend on 'Node' before it is declared");
});

Deno.test("rejects void value types", () => {
  assertCheckError(`function bad(x: void): i32 { return 0; } function main(): i32 { return 0; }`, "Parameter 'x' cannot have type 'void'");
  assertCheckError(`function bad(x: void[1]): i32 { return 0; } function main(): i32 { return 0; }`, "Parameter 'x' cannot have type 'void'");
  assertCheckError(`function main(): i32 { const x: void = 0; return 0; }`, "Variable 'x' cannot have type 'void'");
  assertCheckError(`function main(): i32 { const x: void[1] = []; return 0; }`, "Variable 'x' cannot have type 'void'");
  assertCheckError(`type Bad = { x: void; }; function main(): i32 { return 0; }`, "Field 'x' cannot have type 'void'");
  assertCheckError(`type Bad = { x: void[1]; }; function main(): i32 { return 0; }`, "Field 'x' cannot have type 'void'");
});

Deno.test("rejects inferred array record fields", () => {
  assertCheckError(`type Bad = { xs: i32[]; }; function main(): i32 { return 0; }`, "Field 'xs' cannot have inferred array type");
});

Deno.test("accepts pointer-decayed inferred array parameters", () => {
  check(resolve(parse(lex(`function first(values: i32[]): i32 { return values[0]; } function main(): i32 { const values: i32[] = [1, 2]; return first(values); }`))));
});

Deno.test("rejects pointer-like array targets", () => {
  assertCheckError(`function main(): i32 { const p: i32[3]* = 0; return 0; }`, "Pointer type cannot target array type");
  assertCheckError(`function main(): i32 { const r: i32[3]& = 0; return 0; }`, "Reference type cannot target array type");
});

Deno.test("rejects nested array types", () => {
  assertCheckError(`function main(): i32 { const xs: i32[2][1] = [[1, 2]]; return 0; }`, "Array type cannot target array type");
  assertCheckError(`function main(): i32 { const xs: i32[][] = [[1]]; return 0; }`, "Array type cannot target array type");
});

Deno.test("rejects void references", () => {
  assertCheckError(`function main(): i32 { const r: void& = 0; return 0; }`, "Reference type cannot target void type");
});

Deno.test("checks bare returns from void functions", () => {
  check(resolve(parse(lex(`function done(): void { return; } function main(): i32 { return 0; }`))));
});

Deno.test("rejects returning values from void functions", () => {
  assertCheckError(`function bad(): void { return 0; } function main(): i32 { return 0; }`, "Void function cannot return a value");
});

Deno.test("rejects bare returns from value functions", () => {
  assertCheckError(`function main(): i32 { return; }`, "Function must return 'i32'");
});

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

Deno.test("rejects address of non-addressable expressions", () => {
  assertCheckError(`function value(): i32 { return 1; } function main(): i32 { const p: i32* = value().&; return 0; }`, "Cannot take address of non-addressable expression");
  assertCheckError(`function main(): i32 { const p: i32* = (1 + 2).&; return 0; }`, "Cannot take address of non-addressable expression");
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

Deno.test("rejects empty inferred arrays", () => {
  assertCheckError(`function main(): i32 { const xs: i32[] = []; return 0; }`, "Cannot infer empty array type");
});

Deno.test("checks usize array indexes", () => {
  check(resolve(parse(lex(`function main(): i32 { const xs: i32[] = [1, 2, 3]; const i: usize = 0; return xs[i]; }`))));
});

Deno.test("rejects literal array indexes out of bounds", () => {
  assertCheckError(`function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[3]; }`, "Array index 3 is out of bounds for length 3");
  assertCheckError(`function main(): i32 { const xs: i32[3] = [1, 2, 3]; return xs[3]; }`, "Array index 3 is out of bounds for length 3");
});

Deno.test("rejects array element mismatch", () => {
  assertCheckError(`function main(): i32 { const xs: i32[] = [1, 2.5]; return 0; }`, "Array element type 'f64' is not assignable to 'i32'");
});

Deno.test("rejects fixed array length mismatch", () => {
  assertCheckError(`function main(): i32 { const xs: i32[2] = [1, 2, 3]; return 0; }`, "Array length 3 is not assignable to 'i32[2]'");
});

Deno.test("rejects non-literal array initializers", () => {
  assertCheckError(`function main(): i32 { const xs: i32[] = [1]; const ys: i32[] = xs; return ys[0]; }`, "Array variable initializer must be an array literal");
  assertCheckError(`function main(): i32 { const xs: i32[] = [1]; const ys: i32[1] = xs; return ys[0]; }`, "Array variable initializer must be an array literal");
});

Deno.test("rejects non-literal array field initializers", () => {
  assertCheckError(`type Block = { values: i32[1]; }; function main(): i32 { const xs: i32[] = [1]; const b: Block = { values: xs }; return b.values[0]; }`, "Array variable initializer must be an array literal");
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

Deno.test("rejects assignment to arrays", () => {
  assertCheckError(`function main(): i32 { let xs: i32[] = [1]; xs = [2]; return xs[0]; }`, "Cannot assign to array variable 'xs'");
  assertCheckError(`function main(): i32 { let xs: i32[1] = [1]; xs = [2]; return xs[0]; }`, "Cannot assign to array variable 'xs'");
});

Deno.test("checks bool literals", () => {
  check(resolve(parse(lex(`function flag(): bool { return true; } function main(): i32 { const ok: bool = false; return 0; }`))));
});

Deno.test("rejects non-call expression statements", () => {
  assertCheckError(`function main(): i32 { 1; return 0; }`, "Expression statements must be function calls");
});

Deno.test("checks if else statements", () => {
  check(resolve(parse(lex(`function main(): i32 { if (true) { return 1; } else { return 0; } }`))));
});

Deno.test("rejects non-bool if conditions", () => {
  assertCheckError(`function main(): i32 { if (1) { return 1; } return 0; }`, "If condition type 'i32' is not assignable to 'bool'");
});

Deno.test("rejects non-bool while conditions", () => {
  assertCheckError(`function main(): i32 { while (1) { return 0; } return 0; }`, "While condition type 'i32' is not assignable to 'bool'");
});

Deno.test("rejects modulo on floats", () => {
  assertCheckError(`function main(): i32 { const x: f64 = 7.0 % 2.0; return 0; }`, "Operator '%' requires integer operands");
});

Deno.test("rejects integer divide by zero literals", () => {
  assertCheckError(`function main(): i32 { return 1 / 0; }`, "Operator '/' cannot divide by zero");
  assertCheckError(`function main(): i32 { return 1 % 0; }`, "Operator '%' cannot divide by zero");
});

Deno.test("rejects integer literals outside target range", () => {
  assertCheckError(`function main(): i32 { const x: i8 = 128; return 0; }`, "Integer literal '128' is out of range for 'i8'");
  assertCheckError(`function main(): i32 { const x: u8 = 256; return 0; }`, "Integer literal '256' is out of range for 'u8'");
  assertCheckError(`function main(): i32 { return 2147483648; }`, "Integer literal '2147483648' is out of range for 'i32'");
});

Deno.test("rejects float literals outside target range", () => {
  const huge = `1${"0".repeat(39)}.0`;
  assertCheckError(`function main(): i32 { const x: f32 = ${huge}; return 0; }`, `Float literal '${huge}' is out of range for 'f32'`);
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
