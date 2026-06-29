import type { FunctionDecl, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import {
  optionalCTypeNameFromTypeName,
  optionalUnwrapFunctionNameFromTypeName,
} from "c/optional_names.ts";
import { emitOptionalCType } from "c/optionals.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type b8 = boolean;
type OptionalCollectionMode =
  | "pre-helper"
  | "post-helper"
  | "post-generated"
  | "post-generated-helper";

export interface PreAliasOptionalDefinitions {
  definitions: Str[];
  names: Set<Str>;
}

export function collectPreAliasOptionalTypeDefinitions(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): PreAliasOptionalDefinitions {
  const elements = new Map<Str, TypeRef>();
  for (const alias of typeAliases) collectPreAliasTypeOptionals(alias.type, elements);
  return {
    definitions: [...elements.values()].map((element) =>
      emitOptionalCType(element, context.typeAliases)
    ),
    names: new Set(elements.keys()),
  };
}

export function collectOptionalTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str> = new Set<Str>(),
): Str[] {
  return collectOptionalDefinitionsForMode(program, context, skipped, "pre-helper");
}

export function collectPostHelperOptionalTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str> = new Set<Str>(),
): Str[] {
  return collectOptionalDefinitionsForMode(program, context, skipped, "post-helper");
}

export function collectPostGeneratedOptionalTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str> = new Set<Str>(),
): Str[] {
  return collectOptionalDefinitionsForMode(program, context, skipped, "post-generated");
}

export function collectPostGeneratedHelperOptionalTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str> = new Set<Str>(),
): Str[] {
  return collectOptionalDefinitionsForMode(program, context, skipped, "post-generated-helper");
}

function collectOptionalDefinitionsForMode(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
  mode: OptionalCollectionMode,
): Str[] {
  const elements = new Map<Str, TypeRef>();
  const generatedAliases = generatedAliasNames(program.typeAliases);
  for (const alias of program.typeAliases) {
    collectGeneratedAliasOptionals(alias, elements, mode, generatedAliases);
  }
  for (const fn of program.functions) {
    collectFunctionOptionals(fn, elements, mode, generatedAliases);
  }
  const definitions = [...elements.entries()]
    .filter(([name]) => !skipped.has(name))
    .map(([, element]) => emitOptionalCType(element, context.typeAliases));
  if (mode !== "pre-helper") return definitions;
  const emitted = new Set([...elements.keys(), ...skipped]);
  for (const type of context.expressionTypes?.values() ?? []) {
    const element = optionalTypeNameElement(type.type);
    if (element !== null && !emitted.has(element)) {
      emitted.add(element);
      definitions.push(emitOptionalCTypeNameDefinition(element, context));
    }
  }
  return definitions;
}

function collectPreAliasTypeOptionals(type: TypeRef, elements: Map<Str, TypeRef>): void {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null && isPreAliasOptionalElement(optionalElement)) {
    elements.set(typeName(optionalElement), optionalElement);
  }
  if (type.kind === "RecordTypeRef") {
    for (const field of type.fields) collectPreAliasTypeOptionals(field.type, elements);
  }
}

function isPreAliasOptionalElement(type: TypeRef): b8 {
  switch (type.kind) {
    case "NamedTypeRef":
      return isBuiltinTypeName(type.name);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return isPreAliasOptionalElement(type.element);
    default:
      return false;
  }
}

function collectGeneratedAliasOptionals(
  alias: TypeAliasDecl,
  elements: Map<Str, TypeRef>,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): void {
  if (alias.generated !== true) return;
  collectTypeOptionals(alias.type, elements, mode, generatedAliases);
}

function isBuiltinTypeName(name: Str): b8 {
  return [
    "u8",
    "u16",
    "u32",
    "u64",
    "i8",
    "i16",
    "i32",
    "i64",
    "f32",
    "f64",
    "b8",
    "usize",
    "void",
  ].includes(name);
}

function emitOptionalCTypeNameDefinition(element: Str, context: EmitContext): Str {
  const name = optionalCTypeNameFromTypeName(element);
  const valueType = optionalElementCTypeName(element, context);
  const unwrapName = optionalUnwrapFunctionNameFromTypeName(element);
  return [
    `typedef struct ${name} { b8 present; ${valueType} value; } ${name};`,
    `static inline ${valueType} ${unwrapName}(${name} value) { if (!value.present) abort(); return value.value; }`,
  ].join("\n");
}

function optionalElementCTypeName(element: Str, context: EmitContext): Str {
  if (element === "bool") return "b8";
  return context.typeAliases.get(element)?.cName ?? element;
}

function collectFunctionOptionals(
  fn: FunctionDecl,
  elements: Map<Str, TypeRef>,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): void {
  for (const param of fn.params) collectTypeOptionals(param.type, elements, mode, generatedAliases);
  collectTypeOptionals(fn.returnType, elements, mode, generatedAliases);
  if (!fn.body) return;
  for (const stmt of fn.body.statements) {
    collectStatementOptionals(stmt, elements, mode, generatedAliases);
  }
}

function collectStatementOptionals(
  stmt: Statement,
  elements: Map<Str, TypeRef>,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): void {
  if (stmt.kind === "VarDeclStmt" && stmt.type !== null) {
    collectTypeOptionals(stmt.type, elements, mode, generatedAliases);
  }
  if (stmt.kind === "WhileStmt" || stmt.kind === "DoWhileStmt") {
    collectBlockOptionals(stmt.body.statements, elements, mode, generatedAliases);
  }
  if (stmt.kind !== "IfStmt") return;
  collectBlockOptionals(stmt.thenBody.statements, elements, mode, generatedAliases);
  if (stmt.elseBody) {
    collectBlockOptionals(stmt.elseBody.statements, elements, mode, generatedAliases);
  }
}

function collectBlockOptionals(
  statements: Statement[],
  elements: Map<Str, TypeRef>,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): void {
  for (const statement of statements) {
    collectStatementOptionals(statement, elements, mode, generatedAliases);
  }
}

function collectTypeOptionals(
  type: TypeRef,
  elements: Map<Str, TypeRef>,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): void {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) {
    if (optionalElementMatchesMode(optionalElement, mode, generatedAliases)) {
      elements.set(typeName(optionalElement), optionalElement);
    }
    collectTypeOptionals(optionalElement, elements, mode, generatedAliases);
    return;
  }
  switch (type.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeOptionals(type.element, elements, mode, generatedAliases);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) {
        collectTypeOptionals(param.type, elements, mode, generatedAliases);
      }
      collectTypeOptionals(type.returnType, elements, mode, generatedAliases);
      return;
    case "TupleTypeRef":
      for (const element of type.elements) {
        collectTypeOptionals(element, elements, mode, generatedAliases);
      }
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) {
        collectTypeOptionals(member, elements, mode, generatedAliases);
      }
      return;
    case "ConditionalTypeRef":
      collectTypeOptionals(type.checkType, elements, mode, generatedAliases);
      collectTypeOptionals(type.extendsType, elements, mode, generatedAliases);
      collectTypeOptionals(type.trueType, elements, mode, generatedAliases);
      collectTypeOptionals(type.falseType, elements, mode, generatedAliases);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) {
        collectTypeOptionals(field.type, elements, mode, generatedAliases);
      }
      return;
    case "NamedTypeRef":
      return;
  }
}

function optionalElementMatchesMode(
  type: TypeRef,
  mode: OptionalCollectionMode,
  generatedAliases: Set<Str>,
): b8 {
  const postHelper = isPostHelperOptionalElement(type);
  const postGenerated = isGeneratedAliasOptionalElement(type, generatedAliases);
  const postGeneratedHelper = typeContainsGeneratedAlias(type, generatedAliases);
  if (mode === "post-helper") return postHelper && !postGenerated && !postGeneratedHelper;
  if (mode === "post-generated") return postGenerated;
  if (mode === "post-generated-helper") return !postGenerated && postGeneratedHelper;
  return !postHelper && !postGenerated && !postGeneratedHelper;
}

function isPostHelperOptionalElement(type: TypeRef): b8 {
  switch (type.kind) {
    case "SliceTypeRef":
    case "TupleTypeRef":
      return true;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return isPostHelperOptionalElement(type.element);
    default:
      return false;
  }
}

function isGeneratedAliasOptionalElement(type: TypeRef, generatedAliases: Set<Str>): b8 {
  switch (type.kind) {
    case "NamedTypeRef":
      return generatedAliases.has(type.name);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return isGeneratedAliasOptionalElement(type.element, generatedAliases);
    case "SliceTypeRef":
    case "TupleTypeRef":
    case "RecordTypeRef":
      return false;
    default:
      return false;
  }
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
