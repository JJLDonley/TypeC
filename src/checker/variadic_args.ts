import type { TypeName } from "core/tast.ts";
import { isPointerLikeTypeName, parseArrayTypeName } from "checker/type_name_shapes.ts";

const variadicScalarTypes = new Set<TypeName>([
  "i32",
  "u32",
  "i64",
  "u64",
  "usize",
  "f64",
  "c_int",
  "c_uint",
  "c_long",
  "c_ulong",
  "c_longlong",
  "c_ulonglong",
  "c_double",
]);

type b8 = boolean;

export function isVariadicArgumentType(type: TypeName): b8 {
  if (variadicScalarTypes.has(type)) return true;
  if (isPointerLikeTypeName(type)) return true;
  return parseArrayTypeName(type) !== null;
}
