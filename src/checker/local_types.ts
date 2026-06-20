import type { TypeName } from "core/tast.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

export function localDeclaredType(expected: TypeName, actual: TypeName): TypeName {
  if (parseArrayTypeName(expected)?.length === null) return actual;
  return expected;
}
