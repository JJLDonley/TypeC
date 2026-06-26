import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function functionTypeName(fn: FunctionDecl): TypeName {
  const params = fn.params.map((param) => `${param.name}: ${typeName(param.type)}`).join(", ");
  return `(${params}) => ${typeName(fn.returnType)}`;
}
