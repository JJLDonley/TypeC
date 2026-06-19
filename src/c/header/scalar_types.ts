type Str = string;

const scalarTypeMap = new Map<Str, Str>([
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

export function mapScalarCHeaderType(type: Str): Str | null {
  return scalarTypeMap.get(type) ?? null;
}
