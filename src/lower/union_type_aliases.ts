import type { TaggedUnionDecl, TaggedUnionVariant, TypeAliasDecl, TypeRef } from "core/ast.ts";

type Str = string;

export interface LoweredUnionAliases {
  typeAliases: TypeAliasDecl[];
  taggedUnions: TaggedUnionDecl[];
}

export function lowerUnionTypeAliases(typeAliases: TypeAliasDecl[]): LoweredUnionAliases {
  return {
    typeAliases: typeAliases.filter((alias) => alias.type.kind !== "UnionTypeRef"),
    taggedUnions: typeAliases.flatMap(unionAliasTaggedUnion),
  };
}

function unionAliasTaggedUnion(alias: TypeAliasDecl): TaggedUnionDecl[] {
  if (alias.type.kind !== "UnionTypeRef") return [];
  return [{
    kind: "TaggedUnionDecl",
    exported: alias.exported,
    name: alias.name,
    cName: alias.cName,
    variants: alias.type.members.map(unionMemberVariant),
    span: alias.span,
  }];
}

function unionMemberVariant(member: TypeRef): TaggedUnionVariant {
  return {
    name: unionMemberName(member),
    payload: member,
    span: member.span,
  };
}

function unionMemberName(member: TypeRef): Str {
  if (member.kind === "NamedTypeRef") return member.name.replaceAll(".", "_");
  if (member.kind === "PointerTypeRef") return `${unionMemberName(member.element)}Ptr`;
  if (member.kind === "ReferenceTypeRef") return `${unionMemberName(member.element)}Ref`;
  if (member.kind === "SafePointerTypeRef") return `${unionMemberName(member.element)}SafePtr`;
  if (member.kind === "SliceTypeRef") return `${unionMemberName(member.element)}Slice`;
  if (member.kind === "InferredArrayTypeRef") return `${unionMemberName(member.element)}Array`;
  if (member.kind === "FixedArrayTypeRef") return `${unionMemberName(member.element)}Array${member.sizeText}`;
  if (member.kind === "TupleTypeRef") return `Tuple${member.elements.map(unionMemberName).join("_")}`;
  if (member.kind === "FunctionTypeRef") return "Function";
  if (member.kind === "RecordTypeRef") return "Record";
  return "Union";
}
