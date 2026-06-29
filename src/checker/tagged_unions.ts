import { DUPLICATE_UNION_VARIANT } from "core/diagnostic_codes.ts";
import type { TaggedUnionDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { checkTypeRef } from "checker/type_validation.ts";

type Str = string;

export function checkTaggedUnions(
  unions: TaggedUnionDecl[],
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str> = new Set<Str>(),
): Diagnostic[] {
  return unions.flatMap((unionDecl) => checkTaggedUnion(unionDecl, typeAliases, interfaceNames));
}

function checkTaggedUnion(
  unionDecl: TaggedUnionDecl,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const variants = new Set<Str>();
  for (const variant of unionDecl.variants) {
    if (variants.has(variant.name)) {
      diagnostics.push({
        message: `Duplicate union variant '${variant.name}'`,
        code: DUPLICATE_UNION_VARIANT,
        span: variant.span,
      });
    }
    variants.add(variant.name);
    if (variant.payload !== null) {
      diagnostics.push(...checkTypeRef(variant.payload, typeAliases, interfaceNames));
    }
  }
  return diagnostics;
}
