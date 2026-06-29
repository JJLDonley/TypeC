import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { isLiteralOnlyTypeRef } from "core/literal_types.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitTypeAlias } from "emitter/type_aliases.ts";

type Str = string;
type b8 = boolean;

export interface EmittedTypeAlias {
  alias: TypeAliasDecl;
  text: Str;
}

export function collectEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  return collectMatchingEmittedTypeAliases(typeAliases, context, () => true);
}

export function collectRegularEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  return collectMatchingEmittedTypeAliases(
    typeAliases,
    context,
    (alias) => !isGeneratedAlias(alias),
  );
}

export function collectGeneratedEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  return collectMatchingEmittedTypeAliases(typeAliases, context, isGeneratedAlias);
}

export function collectPreOptionalGeneratedEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  const generatedAliases = generatedAliasNames(typeAliases);
  return collectMatchingEmittedTypeAliases(
    typeAliases,
    context,
    (alias) =>
      isGeneratedAlias(alias) && !hasGeneratedAliasOptionalDependency(alias.type, generatedAliases),
  );
}

export function collectPostOptionalGeneratedEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  const generatedAliases = generatedAliasNames(typeAliases);
  return collectMatchingEmittedTypeAliases(
    typeAliases,
    context,
    (alias) =>
      isGeneratedAlias(alias) && hasGeneratedAliasOptionalDependency(alias.type, generatedAliases),
  );
}

function collectMatchingEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
  matches: (alias: TypeAliasDecl) => b8,
): EmittedTypeAlias[] {
  const seen = new Map<Str, Str>();
  const emitted: EmittedTypeAlias[] = [];
  for (const alias of typeAliases) {
    if (matches(alias)) collectEmittedTypeAlias(alias, context, seen, emitted);
  }
  return emitted;
}

function isGeneratedAlias(alias: TypeAliasDecl): b8 {
  return alias.generated === true;
}

function hasGeneratedAliasOptionalDependency(type: TypeRef, generatedAliases: Set<Str>): b8 {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) return containsGeneratedAlias(optionalElement, generatedAliases);
  return childTypes(type).some((child) =>
    hasGeneratedAliasOptionalDependency(child, generatedAliases)
  );
}

function containsGeneratedAlias(type: TypeRef, generatedAliases: Set<Str>): b8 {
  if (type.kind === "NamedTypeRef" && generatedAliases.has(type.name)) return true;
  return childTypes(type).some((child) => containsGeneratedAlias(child, generatedAliases));
}

function childTypes(type: TypeRef): TypeRef[] {
  switch (type.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return [type.element];
    case "FunctionTypeRef":
      return [...type.params.map((param) => param.type), type.returnType];
    case "TupleTypeRef":
      return type.elements;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      return type.members;
    case "ConditionalTypeRef":
      return [type.checkType, type.extendsType, type.trueType, type.falseType];
    case "RecordTypeRef":
      return type.fields.map((field) => field.type);
    case "NamedTypeRef":
      return type.typeArgs ?? [];
    default:
      return [];
  }
}

function generatedAliasNames(typeAliases: TypeAliasDecl[]): Set<Str> {
  const names = new Set<Str>();
  for (const alias of typeAliases) {
    if (!isGeneratedAlias(alias)) continue;
    names.add(alias.name);
    names.add(alias.cName ?? alias.name);
  }
  return names;
}

function collectEmittedTypeAlias(
  alias: TypeAliasDecl,
  context: EmitContext,
  seen: Map<Str, Str>,
  emitted: EmittedTypeAlias[],
): void {
  if (isLiteralOnlyTypeRef(alias.type)) return;
  const text = emitTypeAlias(alias, context);
  const previous = seen.get(alias.cName ?? alias.name);
  if (previous === text) return;
  if (previous) throw new Error(`Duplicate C type alias '${alias.cName ?? alias.name}'`);
  seen.set(alias.cName ?? alias.name, text);
  emitted.push({ alias, text });
}
