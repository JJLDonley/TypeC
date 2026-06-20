import {
  isPointerLikeTypeName,
  parseArrayTypeName,
  parseFunctionTypeName,
  pointeeTypeName,
} from "checker/type_name_shapes.ts";
import {
  integerRange,
  isAssignable,
  isFloatType,
  isIntegerType,
  isNumericType,
  maxF32,
} from "checker/types.ts";

type Str = string;
type b8 = boolean;

type IntLiteralValue = bigint;

Deno.test("classifies checker primitive types", () => {
  assertSame(isNumericType("i32"), true);
  assertSame(isNumericType("bool"), false);
  assertSame(isIntegerType("usize"), true);
  assertSame(isIntegerType("f32"), false);
  assertSame(isFloatType("f32"), true);
  assertSame(isFloatType("i32"), false);
  assertSame(isPointerLikeTypeName("Vec*"), true);
  assertSame(isPointerLikeTypeName("Vec&"), true);
});

Deno.test("reads checker numeric ranges", () => {
  assertBigInt(integerRange("i8")?.min ?? 0n, -128n);
  assertBigInt(integerRange("u64")?.max ?? 0n, 18446744073709551615n);
  assertSame(integerRange("f32") === null, true);
  assertSame(maxF32 > 0, true);
});

Deno.test("parses checker array types", () => {
  const inferred = parseArrayTypeName("i32[]");
  const fixed = parseArrayTypeName("i32[3]");

  assertText(inferred?.element ?? "", "i32");
  assertSame(inferred?.length === null, true);
  assertBigInt(fixed?.length ?? 0n, 3n);
  assertSame(parseArrayTypeName("i32") === null, true);
});

Deno.test("parses checker function types", () => {
  const type = parseFunctionTypeName("(value: i32, data: u8*) => bool");

  assertText(type?.params[0]?.name ?? "", "value");
  assertText(type?.params[0]?.type ?? "", "i32");
  assertText(type?.params[1]?.type ?? "", "u8*");
  assertText(type?.returnType ?? "", "bool");
  assertSame(parseFunctionTypeName("i32") === null, true);
});

Deno.test("parses shared checker type name shapes", () => {
  assertText(parseArrayTypeName("u8[4]")?.element ?? "", "u8");
  assertBigInt(parseArrayTypeName("u8[4]")?.length ?? 0n, 4n);
  assertSame(isPointerLikeTypeName("u8*"), true);
  assertText(pointeeTypeName("u8*"), "u8");
});

Deno.test("checks assignability", () => {
  assertSame(isAssignable("i32", "i32"), true);
  assertSame(isAssignable("i32[3]", "i32[]"), true);
  assertSame(isAssignable("i32[3]", "i32[2]"), false);
  assertSame(isAssignable("Vec&", "Vec*"), true);
  assertSame(isAssignable("Vec*", "Vec&"), false);
  assertSame(isAssignable("u8*", "void*"), true);
  assertSame(isAssignable("u8[4]", "void*"), true);
  assertSame(isAssignable("void*", "u8*"), false);
  assertSame(isAssignable("(value: i32) => i32", "(arg0: i32) => i32"), true);
  assertSame(isAssignable("(value: i64) => i32", "(arg0: i32) => i32"), false);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertBigInt(actual: IntLiteralValue, expected: IntLiteralValue): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
