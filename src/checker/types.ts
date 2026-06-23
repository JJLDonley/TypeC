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
  "c_char",
  "c_schar",
  "c_uchar",
  "c_short",
  "c_ushort",
  "c_int",
  "c_uint",
  "c_long",
  "c_ulong",
  "c_longlong",
  "c_ulonglong",
  "f32",
  "f64",
  "c_float",
  "c_double",
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
  ["c_char", { min: -128n, max: 127n }],
  ["c_schar", { min: -128n, max: 127n }],
  ["c_uchar", { min: 0n, max: 255n }],
  ["c_short", { min: -32768n, max: 32767n }],
  ["c_ushort", { min: 0n, max: 65535n }],
  ["c_int", { min: -2147483648n, max: 2147483647n }],
  ["c_uint", { min: 0n, max: 4294967295n }],
  ["c_long", { min: -9223372036854775808n, max: 9223372036854775807n }],
  ["c_ulong", { min: 0n, max: 18446744073709551615n }],
  ["c_longlong", { min: -9223372036854775808n, max: 9223372036854775807n }],
  ["c_ulonglong", { min: 0n, max: 18446744073709551615n }],
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
    type === "u16" || type === "u32" || type === "u64" || type === "usize" ||
    type === "c_char" || type === "c_schar" || type === "c_uchar" || type === "c_short" ||
    type === "c_ushort" || type === "c_int" || type === "c_uint" || type === "c_long" ||
    type === "c_ulong" || type === "c_longlong" || type === "c_ulonglong";
}

export function isFloatType(type: TypeName): b8 {
  return type === "f32" || type === "f64" || type === "c_float" || type === "c_double";
}

export function isAssignable(actual: TypeName, expected: TypeName): b8 {
  if (actual === expected) return true;
  if (canonicalNumericType(actual) === canonicalNumericType(expected)) return true;
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

function canonicalNumericType(type: TypeName): TypeName {
  switch (type) {
    case "c_char":
    case "c_schar":
      return "i8";
    case "c_uchar":
      return "u8";
    case "c_short":
      return "i16";
    case "c_ushort":
      return "u16";
    case "c_int":
      return "i32";
    case "c_uint":
      return "u32";
    case "c_long":
    case "c_longlong":
      return "i64";
    case "c_ulong":
    case "c_ulonglong":
      return "u64";
    case "c_float":
      return "f32";
    case "c_double":
      return "f64";
    default:
      return type;
  }
}

function areFunctionTypesAssignable(actual: TypeName, expected: TypeName): b8 {
  const actualFunction = parseFunctionTypeName(actual);
  const expectedFunction = parseFunctionTypeName(expected);
  if (!actualFunction || !expectedFunction) return false;
  if (!isAssignable(actualFunction.returnType, expectedFunction.returnType)) return false;
  if (actualFunction.params.length !== expectedFunction.params.length) return false;
  return actualFunction.params.every((param, index) =>
    isAssignable(param.type, expectedFunction.params[index]!.type)
  );
}
