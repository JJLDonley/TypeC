type Str = string;

type ScalarTypeEntry = [Str, Str];

const coreScalarTypes: ScalarTypeEntry[] = [
  ["void", "void"],
  ["float", "f32"],
  ["double", "f64"],
  ["bool", "bool"],
  ["_Bool", "bool"],
  ["size_t", "usize"],
];

const fixedWidthScalarTypes: ScalarTypeEntry[] = [
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
];

const typeCScalarTypes: ScalarTypeEntry[] = [
  ["i8", "i8"],
  ["i16", "i16"],
  ["i32", "i32"],
  ["i64", "i64"],
  ["u8", "u8"],
  ["u16", "u16"],
  ["u32", "u32"],
  ["u64", "u64"],
];

const cCharScalarTypes: ScalarTypeEntry[] = [
  ["char", "u8"],
  ["signed char", "i8"],
  ["unsigned char", "u8"],
];

const platformScalarTypes: ScalarTypeEntry[] = [
  ["short", "c_short"],
  ["short int", "c_short"],
  ["signed short", "c_short"],
  ["signed short int", "c_short"],
  ["unsigned short", "c_ushort"],
  ["unsigned short int", "c_ushort"],
  ["int", "c_int"],
  ["signed", "c_int"],
  ["signed int", "c_int"],
  ["unsigned", "c_uint"],
  ["unsigned int", "c_uint"],
  ["long", "c_long"],
  ["long int", "c_long"],
  ["signed long", "c_long"],
  ["signed long int", "c_long"],
  ["unsigned long", "c_ulong"],
  ["unsigned long int", "c_ulong"],
  ["long long", "c_longlong"],
  ["long long int", "c_longlong"],
  ["signed long long", "c_longlong"],
  ["signed long long int", "c_longlong"],
  ["unsigned long long", "c_ulonglong"],
  ["unsigned long long int", "c_ulonglong"],
];

const scalarTypeMap = new Map<Str, Str>([
  ...coreScalarTypes,
  ...fixedWidthScalarTypes,
  ...typeCScalarTypes,
  ...cCharScalarTypes,
  ...platformScalarTypes,
]);

export function mapScalarCHeaderType(type: Str): Str | null {
  return scalarTypeMap.get(type) ?? null;
}
