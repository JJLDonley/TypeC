import type { Param, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { parseFunctionTypeName } from "checker/type_name_shapes.ts";

type Str = string;
type usize = number;

export function typeRefFromTypeName(name: TypeName, span: SourceSpan): TypeRef {
  const fn = parseFunctionTypeName(name);
  if (fn !== null) {
    return {
      kind: "FunctionTypeRef",
      params: fn.params.map((param, index) => functionParam(param.name, param.type, index, span)),
      returnType: typeRefFromTypeName(fn.returnType, span),
      span,
    };
  }
  return { kind: "NamedTypeRef", name, span };
}

function functionParam(name: Str, type: TypeName, index: usize, span: SourceSpan): Param {
  return {
    name: name.length === 0 ? `p${index}` : name,
    type: typeRefFromTypeName(type, span),
    span,
  };
}
