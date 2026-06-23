import type { TaggedUnionDecl, TaggedUnionVariant } from "core/ast.ts";

type Str = string;
type i32 = number;

export function taggedUnionVariant(
  unions: TaggedUnionDecl[],
  unionName: Str,
  variantName: Str,
): TaggedUnionVariant | null {
  return taggedUnionDecl(unions, unionName)?.variants.find((variant) =>
    variant.name === variantName
  ) ?? null;
}

export function taggedUnionDecl(unions: TaggedUnionDecl[], name: Str): TaggedUnionDecl | null {
  return unions.find((unionDecl) => unionDecl.name === name) ?? null;
}

export function taggedUnionVariantTag(unionDecl: TaggedUnionDecl, variantName: Str): i32 | null {
  const index = unionDecl.variants.findIndex((variant) => variant.name === variantName);
  return index < 0 ? null : index;
}

export function taggedUnionCName(unionDecl: TaggedUnionDecl): Str {
  return unionDecl.cName ?? unionDecl.name;
}

export function taggedUnionVariantCName(variant: TaggedUnionVariant): Str {
  return variant.cName ?? variant.name;
}
