import type { Program, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { tupleCTypeName } from "c/tuples.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCDeclarator } from "c/type.ts";
import { optionalTypeElement } from "core/optional_types.ts";

export type Str = string;
type b8 = boolean;
type TupleTypeRef = Extract<TypeRef, { kind: "TupleTypeRef" }>;
type TupleDependencyMode =
  | "pre-generated-alias"
  | "post-generated-alias"
  | "post-generated-optional";

export function collectTupleTypeDefinitions(program: Program, context: EmitContext): Str[] {
  return collectTupleDefinitionsForMode(program, context, "pre-generated-alias");
}

export function collectPostGeneratedAliasTupleTypeDefinitions(
  program: Program,
  context: EmitContext,
): Str[] {
  return collectTupleDefinitionsForMode(program, context, "post-generated-alias");
}

export function collectPostGeneratedOptionalTupleTypeDefinitions(
  program: Program,
  context: EmitContext,
): Str[] {
  return collectTupleDefinitionsForMode(program, context, "post-generated-optional");
}

function collectTupleDefinitionsForMode(
  program: Program,
  context: EmitContext,
  mode: TupleDependencyMode,
): Str[] {
  const generatedAliases = generatedAliasNames(program.typeAliases);
  return collectTupleTypes(program)
    .filter((tuple) => tupleMatchesMode(tuple, generatedAliases, mode))
    .map((tuple) => emitTupleTypeDefinition(tuple, context));
}

function collectTupleTypes(program: Program): TupleTypeRef[] {
  const tuples = new Map<Str, TupleTypeRef>();
  collectProgramTupleTypes(program, tuples);
  return [...tuples.values()];
}

function collectProgramTupleTypes(program: Program, tuples: Map<Str, TupleTypeRef>): void {
  for (const alias of program.typeAliases) collectTypeRefTupleTypes(alias.type, tuples);
  for (const constant of program.constants ?? []) collectTypeRefTupleTypes(constant.type, tuples);
  for (const fn of program.functions) {
    for (const param of fn.params) collectTypeRefTupleTypes(param.type, tuples);
    collectTypeRefTupleTypes(fn.returnType, tuples);
    for (const stmt of fn.body?.statements ?? []) collectStatementTupleTypes(stmt, tuples);
  }
}

function collectStatementTupleTypes(statement: Statement, tuples: Map<Str, TupleTypeRef>): void {
  switch (statement.kind) {
    case "VarDeclStmt":
      if (statement.type !== null) collectTypeRefTupleTypes(statement.type, tuples);
      return;
    case "SwitchStmt":
      for (const switchCase of statement.cases) {
        for (const child of switchCase.statements) collectStatementTupleTypes(child, tuples);
      }
      for (const child of statement.defaultCase?.statements ?? []) {
        collectStatementTupleTypes(child, tuples);
      }
      return;
    case "WhileStmt":
    case "DoWhileStmt":
    case "ForOfStmt":
    case "ForInStmt":
      for (const child of statement.body.statements) collectStatementTupleTypes(child, tuples);
      return;
    case "ForStmt":
      if (statement.initializer) collectStatementTupleTypes(statement.initializer, tuples);
      if (statement.update) collectStatementTupleTypes(statement.update, tuples);
      for (const child of statement.body.statements) collectStatementTupleTypes(child, tuples);
      return;
    case "IfStmt":
      for (const child of statement.thenBody.statements) collectStatementTupleTypes(child, tuples);
      for (const child of statement.elseBody?.statements ?? []) {
        collectStatementTupleTypes(child, tuples);
      }
      return;
    default:
      return;
  }
}

function collectTypeRefTupleTypes(type: TypeRef, tuples: Map<Str, TupleTypeRef>): void {
  switch (type.kind) {
    case "TupleTypeRef":
      collectTupleType(type, tuples);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeRefTupleTypes(type.element, tuples);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeRefTupleTypes(param.type, tuples);
      collectTypeRefTupleTypes(type.returnType, tuples);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectTypeRefTupleTypes(member, tuples);
      return;
    case "ConditionalTypeRef":
      collectTypeRefTupleTypes(type.checkType, tuples);
      collectTypeRefTupleTypes(type.extendsType, tuples);
      collectTypeRefTupleTypes(type.trueType, tuples);
      collectTypeRefTupleTypes(type.falseType, tuples);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeRefTupleTypes(field.type, tuples);
      return;
    case "NamedTypeRef":
      for (const typeArg of type.typeArgs ?? []) collectTypeRefTupleTypes(typeArg, tuples);
      return;
  }
}

function collectTupleType(type: TupleTypeRef, tuples: Map<Str, TupleTypeRef>): void {
  for (const element of type.elements) collectTypeRefTupleTypes(element, tuples);
  const name = tupleCTypeName(type.elements);
  if (!tuples.has(name)) tuples.set(name, type);
}

function tupleMatchesMode(
  tuple: TupleTypeRef,
  generatedAliases: Set<Str>,
  mode: TupleDependencyMode,
): b8 {
  const dependsOnGeneratedOptional = tupleDependsOnGeneratedOptional(tuple, generatedAliases);
  const dependsOnGeneratedAlias = tupleDependsOnGeneratedAlias(tuple, generatedAliases);
  if (mode === "post-generated-optional") return dependsOnGeneratedOptional;
  if (mode === "post-generated-alias") {
    return dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
  }
  return !dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
}

function tupleDependsOnGeneratedAlias(tuple: TupleTypeRef, generatedAliases: Set<Str>): b8 {
  return tuple.elements.some((element) => typeContainsGeneratedAlias(element, generatedAliases));
}

function tupleDependsOnGeneratedOptional(tuple: TupleTypeRef, generatedAliases: Set<Str>): b8 {
  return tuple.elements.some((element) =>
    typeDependsOnGeneratedOptional(element, generatedAliases)
  );
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

function emitTupleTypeDefinition(type: TupleTypeRef, context: EmitContext): Str {
  const fields = type.elements.map((element, index) =>
    `  ${emitCDeclarator(element, `_${index}`, context.typeAliases)};`
  );
  return [
    `typedef struct ${tupleCTypeName(type.elements)} {`,
    ...fields,
    `} ${tupleCTypeName(type.elements)};`,
  ].join("\n");
}
