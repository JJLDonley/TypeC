import type { Expression, TaggedUnionDecl, TaggedUnionVariant } from "core/ast.ts";
import {
  taggedUnionCName,
  taggedUnionVariant,
  taggedUnionVariantCName,
  taggedUnionVariantTag,
} from "core/tagged_unions.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

type MethodCallExpr = Extract<Expression, { kind: "MethodCallExpr" }>;
type FieldAccessExpr = Extract<Expression, { kind: "FieldAccessExpr" }>;

export function emitTaggedUnionTypeDefinition(
  unionDecl: TaggedUnionDecl,
  context: EmitContext,
): Str {
  const name = taggedUnionCName(unionDecl);
  const payloads = payloadVariants(unionDecl).map((variant) => emitPayloadField(variant, context));
  const data = payloads.length === 0 ? ["    u8 _empty;"] : payloads;
  return [
    `typedef struct ${name} {`,
    "  i32 tag;",
    "  union {",
    ...data,
    "  } data;",
    `} ${name};`,
  ].join("\n");
}

export function emitTaggedUnionConstants(unionDecl: TaggedUnionDecl): Str[] {
  return unionDecl.variants.map((variant) => {
    const tag = taggedUnionVariantTag(unionDecl, variant.name) ?? 0;
    return `static const i32 ${tagConstantName(unionDecl, variant)} = ${tag};`;
  });
}

export function emitTaggedUnionConstructor(
  expr: MethodCallExpr,
  context: EmitContext,
  emitExpected: (expr: Expression, expectedType: Str, context: EmitContext) => Str,
): Str | null {
  if (expr.receiver.kind !== "IdentifierExpr") return null;
  const unionName = expr.receiver.name;
  const variant = taggedUnionVariant(
    context.program?.taggedUnions ?? [],
    unionName,
    expr.method,
  );
  const unionDecl =
    (context.program?.taggedUnions ?? []).find((candidate) => candidate.name === unionName) ?? null;
  if (variant === null || unionDecl === null) return null;
  const name = taggedUnionCName(unionDecl);
  const tag = tagConstantName(unionDecl, variant);
  if (variant.payload === null) return `(${name}){ .tag = ${tag} }`;
  const value = emitExpected(
    expr.args[0]!,
    emitCType(variant.payload, context.typeAliases),
    context,
  );
  return `(${name}){ .tag = ${tag}, .data.${taggedUnionVariantCName(variant)} = ${value} }`;
}

export function emitTaggedUnionFieldAccess(
  expr: FieldAccessExpr,
  receiverType: Str,
  context: EmitContext,
  emitOperand: (expr: Expression, context: EmitContext) => Str,
): Str | null {
  const unionDecl =
    (context.program?.taggedUnions ?? []).find((candidate) => candidate.name === receiverType) ??
      null;
  if (unionDecl === null) return null;
  const operand = emitOperand(expr.operand, context);
  if (expr.field === "tag") return `${operand}.tag`;
  const variant = unionDecl.variants.find((candidate) => candidate.name === expr.field) ?? null;
  if (variant === null || variant.payload === null) return null;
  return `${operand}.data.${taggedUnionVariantCName(variant)}`;
}

function payloadVariants(unionDecl: TaggedUnionDecl): TaggedUnionVariant[] {
  return unionDecl.variants.filter((variant) => variant.payload !== null);
}

function emitPayloadField(variant: TaggedUnionVariant, context: EmitContext): Str {
  return `    ${emitCType(variant.payload!, context.typeAliases)} ${
    taggedUnionVariantCName(variant)
  };`;
}

function tagConstantName(unionDecl: TaggedUnionDecl, variant: TaggedUnionVariant): Str {
  return `${taggedUnionCName(unionDecl)}_${taggedUnionVariantCName(variant)}_TAG`;
}
