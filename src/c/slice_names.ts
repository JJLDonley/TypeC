import type { TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function sliceCTypeName(element: TypeRef): Str {
  return `Slice_${sanitizeSliceElementName(typeName(element))}`;
}

function sanitizeSliceElementName(name: Str): Str {
  return name.replace(/[^A-Za-z0-9_]/g, "_");
}
