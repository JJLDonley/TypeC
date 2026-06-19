import type { TypeName } from "core/tast.ts";
import { parseArrayType } from "checker/types.ts";

export function localDeclaredType(expected: TypeName, actual: TypeName): TypeName {
  if (parseArrayType(expected)?.length === null) return actual;
  return expected;
}
