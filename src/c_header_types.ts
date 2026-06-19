import { TypeCError } from "./diagnostics.ts";

type Str = string;

const typeMap = new Map<Str, Str>([
  ["void", "void"],
  ["int8_t", "i8"],
  ["int16_t", "i16"],
  ["int32_t", "i32"],
  ["int64_t", "i64"],
  ["uint8_t", "u8"],
  ["uint16_t", "u16"],
  ["uint32_t", "u32"],
  ["uint64_t", "u64"],
  ["__int8_t", "i8"],
  ["__int16_t", "i16"],
  ["__int32_t", "i32"],
  ["__int64_t", "i64"],
  ["__uint8_t", "u8"],
  ["__uint16_t", "u16"],
  ["__uint32_t", "u32"],
  ["__uint64_t", "u64"],
  ["char", "u8"],
  ["signed char", "i8"],
  ["unsigned char", "u8"],
  ["i8", "i8"],
  ["i16", "i16"],
  ["i32", "i32"],
  ["i64", "i64"],
  ["u8", "u8"],
  ["u16", "u16"],
  ["u32", "u32"],
  ["u64", "u64"],
  ["float", "f32"],
  ["double", "f64"],
  ["bool", "b8"],
  ["_Bool", "b8"],
  ["size_t", "usize"],
]);

export function mapCHeaderType(type: Str): Str {
  const normalized = normalizeCHeaderType(type);
  if (normalized.endsWith("*")) return `${mapCHeaderType(normalized.slice(0, -1))}*`;
  const mapped = typeMap.get(normalized);
  if (mapped) return mapped;
  throw new TypeCError([{ message: `Unsupported C type '${type}'` }]);
}

function normalizeCHeaderType(type: Str): Str {
  return type.replace(/\bconst\b/g, "").replace(/\bvolatile\b/g, "").replace(/\brestrict\b/g, "").replace(/\b__restrict\b/g, "").replace(/\b__restrict__\b/g, "").replace(/\b_Nonnull\b/g, "").replace(/\b_Nullable\b/g, "").replace(/\b_Null_unspecified\b/g, "").replace(/\s*\*\s*/g, "*").replace(/\s+/g, " ").trim();
}
