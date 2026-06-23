import type { TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function optionalCTypeName(element: TypeRef): Str {
  return optionalCTypeNameFromTypeName(typeName(element));
}

export function optionalCTypeNameFromTypeName(name: Str): Str {
  return `Optional_${sanitizeOptionalElementName(name)}`;
}

export function optionalUnwrapFunctionNameFromTypeName(name: Str): Str {
  return `__typec_unwrap_${optionalCTypeNameFromTypeName(name)}`;
}

function sanitizeOptionalElementName(name: Str): Str {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}
