import type { TypeName } from "core/tast.ts";
import { parseFunctionTypeName } from "checker/type_name_shapes.ts";

type Str = string;

export function emitTypeNameDeclarator(type: TypeName, name: Str): Str {
  const fn = parseFunctionTypeName(type);
  if (fn !== null) {
    const params = fn.params.map((param) => param.type).join(", ");
    return `${fn.returnType} (*${name})(${params})`;
  }
  return `${type} ${name}`;
}
