import type { FunctionDecl, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import { emitSliceCType } from "c/slices.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type b8 = boolean;
type SliceDependencyMode =
  | "pre-generated-alias"
  | "post-generated-alias"
  | "post-generated-optional";

export function collectSliceTypeDefinitions(program: CheckedProgram, context: EmitContext): Str[] {
  return collectSliceDefinitionsForMode(program, context, "pre-generated-alias");
}

export function collectPostGeneratedAliasSliceTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectSliceDefinitionsForMode(program, context, "post-generated-alias");
}

export function collectPostGeneratedOptionalSliceTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectSliceDefinitionsForMode(program, context, "post-generated-optional");
}

function collectSliceDefinitionsForMode(
  program: CheckedProgram,
  context: EmitContext,
  mode: SliceDependencyMode,
): Str[] {
  const generatedAliases = generatedAliasNames(program.typeAliases);
  const elements = new Map<Str, TypeRef>();
  for (const alias of program.typeAliases) collectTypeAliasSlices(alias, elements);
  for (const fn of program.functions) collectFunctionSlices(fn, elements);
  return [...elements.values()]
    .filter((element) => sliceElementMatchesMode(element, generatedAliases, mode))
    .map((element) => emitSliceCType(element, context.typeAliases));
}

function collectTypeAliasSlices(alias: TypeAliasDecl, elements: Map<Str, TypeRef>): void {
  collectTypeSlices(alias.type, elements);
}

function collectFunctionSlices(fn: FunctionDecl, elements: Map<Str, TypeRef>): void {
  for (const param of fn.params) collectTypeSlices(param.type, elements);
  collectTypeSlices(fn.returnType, elements);
  if (!fn.body) return;
  for (const stmt of fn.body.statements) collectStatementSlices(stmt, elements);
}

function collectStatementSlices(stmt: Statement, elements: Map<Str, TypeRef>): void {
  if (stmt.kind === "VarDeclStmt" && stmt.type !== null) collectTypeSlices(stmt.type, elements);
  if (stmt.kind === "WhileStmt" || stmt.kind === "DoWhileStmt") {
    for (const child of stmt.body.statements) collectStatementSlices(child, elements);
  }
  if (stmt.kind !== "IfStmt") return;
  for (const child of stmt.thenBody.statements) collectStatementSlices(child, elements);
  if (stmt.elseBody) {
    for (const child of stmt.elseBody.statements) collectStatementSlices(child, elements);
  }
}

function collectTypeSlices(type: TypeRef, elements: Map<Str, TypeRef>): void {
  switch (type.kind) {
    case "SliceTypeRef":
      elements.set(typeName(type.element), type.element);
      collectTypeSlices(type.element, elements);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeSlices(type.element, elements);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeSlices(param.type, elements);
      collectTypeSlices(type.returnType, elements);
      return;
    case "TupleTypeRef":
      for (const element of type.elements) collectTypeSlices(element, elements);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectTypeSlices(member, elements);
      return;
    case "ConditionalTypeRef":
      collectTypeSlices(type.checkType, elements);
      collectTypeSlices(type.extendsType, elements);
      collectTypeSlices(type.trueType, elements);
      collectTypeSlices(type.falseType, elements);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeSlices(field.type, elements);
      return;
    case "NamedTypeRef":
      for (const typeArg of type.typeArgs ?? []) collectTypeSlices(typeArg, elements);
      return;
  }
}

function sliceElementMatchesMode(
  element: TypeRef,
  generatedAliases: Set<Str>,
  mode: SliceDependencyMode,
): b8 {
  const dependsOnGeneratedOptional = typeDependsOnGeneratedOptional(element, generatedAliases);
  const dependsOnGeneratedAlias = typeContainsGeneratedAlias(element, generatedAliases);
  if (mode === "post-generated-optional") return dependsOnGeneratedOptional;
  if (mode === "post-generated-alias") {
    return dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
  }
  return !dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
}

function typeDependsOnGeneratedOptional(type: TypeRef, generatedAliases: Set<Str>): b8 {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) {
    return typeContainsGeneratedAlias(optionalElement, generatedAliases);
  }
  return childTypeRefs(type).some((child) =>
    typeDependsOnGeneratedOptional(child, generatedAliases)
  );
}

function typeContainsGeneratedAlias(type: TypeRef, generatedAliases: Set<Str>): b8 {
  if (type.kind === "NamedTypeRef" && generatedAliases.has(type.name)) return true;
  return childTypeRefs(type).some((child) => typeContainsGeneratedAlias(child, generatedAliases));
}

function childTypeRefs(type: TypeRef): TypeRef[] {
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
    if (alias.generated !== true) continue;
    names.add(alias.name);
    names.add(alias.cName ?? alias.name);
  }
  return names;
}
