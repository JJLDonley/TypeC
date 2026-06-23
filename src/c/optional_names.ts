import type { TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function optionalCTypeName(element: TypeRef): Str {
  return `Optional_${sanitizeOptionalElementName(typeName(element))}`;
}

function sanitizeOptionalElementName(name: Str): Str {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}
