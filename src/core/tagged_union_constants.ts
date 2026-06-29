import type { ConstDecl, TaggedUnionDecl, TaggedUnionVariant } from "core/ast.ts";
import { taggedUnionTagConstantName, taggedUnionVariantTag } from "core/tagged_unions.ts";

type i32 = number;
type IntLiteralValue = bigint;

export function taggedUnionTagConstants(unions: TaggedUnionDecl[]): ConstDecl[] {
  return unions.flatMap(tagConstantsForUnion);
}

function tagConstantsForUnion(unionDecl: TaggedUnionDecl): ConstDecl[] {
  return unionDecl.variants.map((variant) => tagConstant(unionDecl, variant));
}

function tagConstant(unionDecl: TaggedUnionDecl, variant: TaggedUnionVariant): ConstDecl {
  const tag = taggedUnionVariantTag(unionDecl, variant.name) ?? 0;
  return {
    kind: "ConstDecl",
    exported: unionDecl.exported,
    name: `${unionDecl.name}.${variant.name}`,
    cName: taggedUnionTagConstantName(unionDecl, variant),
    type: { kind: "NamedTypeRef", name: "i32", span: variant.span },
    initializer: tagLiteral(tag, variant),
    span: variant.span,
  };
}

function tagLiteral(tag: i32, variant: TaggedUnionVariant): ConstDecl["initializer"] {
  const value: IntLiteralValue = BigInt(tag);
  return { kind: "IntegerLiteral", value, text: value.toString(), span: variant.span };
}
