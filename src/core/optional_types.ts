import type { NamedTypeRef, TypeRef } from "core/ast.ts";
import type { SourcePos } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

export function optionalTypeRef(element: TypeRef): NamedTypeRef {
  return optionalTypeRefWithEnd(element, element.span.end);
}

export function optionalTypeRefWithEnd(element: TypeRef, end: SourcePos): NamedTypeRef {
  return {
    kind: "NamedTypeRef",
    name: "Optional",
    typeArgs: [element],
    span: { start: element.span.start, end },
  };
}

export function isOptionalTypeRef(type: TypeRef): b8 {
  return optionalTypeElement(type) !== null;
}

export function optionalTypeElement(type: TypeRef): TypeRef | null {
  if (type.kind !== "NamedTypeRef") return null;
  if (type.name !== "Optional") return null;
  const typeArgs = type.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}
