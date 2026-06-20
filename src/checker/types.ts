import type { TypeName } from "core/tast.ts";
import { isArrayPointerAssignable, isPointerAssignable } from "checker/pointer_compatibility.ts";
import {
  parseArrayTypeName,
  parseFunctionTypeName,
  parseSliceTypeName,
} from "checker/type_name_shapes.ts";

type Str = string;
type f64 = number;
type b8 = boolean;
type IntLiteralValue = bigint;

export interface IntegerRange {
  min: IntLiteralValue;
  max: IntLiteralValue;
}

const numericTypes = new Set<Str>([
  "i8",
  "i16",
  "i32",
  "i64",
  "u8",
  "u16",
  "u32",
  "u64",
  "usize",
  "f32",
  "f64",
]);
const integerRanges = new Map<Str, IntegerRange>([
  ["i8", { min: -128n, max: 127n }],
  ["i16", { min: -32768n, max: 32767n }],
  ["i32", { min: -2147483648n, max: 2147483647n }],
  ["i64", { min: -9223372036854775808n, max: 9223372036854775807n }],
  ["u8", { min: 0n, max: 255n }],
  ["u16", { min: 0n, max: 65535n }],
  ["u32", { min: 0n, max: 4294967295n }],
  ["u64", { min: 0n, max: 18446744073709551615n }],
]);

export const maxF32: f64 = 3.4028234663852886e38;

export function integerRange(type: TypeName): IntegerRange | null {
  return integerRanges.get(type) ?? null;
}

export function isNumericType(type: TypeName): b8 {
  return numericTypes.has(type);
}

export function isIntegerType(type: TypeName): b8 {
  return type === "i8" || type === "i16" || type === "i32" || type === "i64" || type === "u8" ||
    type === "u16" || type === "u32" || type === "u64" || type === "usize";
}

export function isFloatType(type: TypeName): b8 {
  return type === "f32" || type === "f64";
}

export function isAssignable(actual: TypeName, expected: TypeName): b8 {
  if (actual === expected) return true;
  const expectedArray = parseArrayTypeName(expected);
  const actualArray = parseArrayTypeName(actual);
  if (expectedArray && actualArray) {
    return expectedArray.element === actualArray.element &&
      (expectedArray.length === null || expectedArray.length === actualArray.length);
  }
  const expectedSlice = parseSliceTypeName(expected);
  if (expectedSlice && actualArray !== null && actualArray.length !== null) {
    return expectedSlice.element === actualArray.element;
  }
  if (areFunctionTypesAssignable(actual, expected)) return true;
  if (isArrayPointerAssignable(actual, expected)) return true;
  return isPointerAssignable(actual, expected);
}

function areFunctionTypesAssignable(actual: TypeName, expected: TypeName): b8 {
  const actualFunction = parseFunctionTypeName(actual);
  const expectedFunction = parseFunctionTypeName(expected);
  if (!actualFunction || !expectedFunction) return false;
  if (actualFunction.returnType !== expectedFunction.returnType) return false;
  if (actualFunction.params.length !== expectedFunction.params.length) return false;
  return actualFunction.params.every((param, index) =>
    param.type === expectedFunction.params[index]!.type
  );
}
