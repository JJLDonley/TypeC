import type { Program, RecordTypeRef, Statement, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { recordCTypeName } from "c/records.ts";
import { emitCDeclarator } from "c/type.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type b8 = boolean;
type RecordDependencyMode =
  | "pre-generated-alias"
  | "post-generated-alias"
  | "post-generated-optional";

export function expectedRecordType(typeName: Str, context: EmitContext): RecordTypeRef | null {
  const alias = context.typeAliases.get(typeName) ??
    [...context.typeAliases.values()].find((candidate) => candidate.cName === typeName) ?? null;
  return alias?.type.kind === "RecordTypeRef" ? alias.type : null;
}

export function collectRecordTypeDefinitions(program: Program, context: EmitContext): Str[] {
  return collectRecordDefinitionsForMode(program, context, "pre-generated-alias");
}

export function collectPostGeneratedAliasRecordTypeDefinitions(
  program: Program,
  context: EmitContext,
): Str[] {
  return collectRecordDefinitionsForMode(program, context, "post-generated-alias");
}

export function collectPostGeneratedOptionalRecordTypeDefinitions(
  program: Program,
  context: EmitContext,
): Str[] {
  return collectRecordDefinitionsForMode(program, context, "post-generated-optional");
}

function collectRecordDefinitionsForMode(
  program: Program,
  context: EmitContext,
  mode: RecordDependencyMode,
): Str[] {
  const generatedAliases = generatedAliasNames(program.typeAliases);
  return collectRecordTypes(program, context)
    .filter((record) => recordMatchesMode(record, generatedAliases, mode))
    .map((record) => emitRecordTypeDefinition(record, context));
}

function collectRecordTypes(program: Program, context: EmitContext): RecordTypeRef[] {
  const records = new Map<Str, RecordTypeRef>();
  for (const alias of program.typeAliases) collectGeneratedAliasRecordDependencies(alias, records);
  for (const fn of program.functions) {
    for (const statement of fn.body?.statements ?? []) {
      collectStatementRecordTypes(statement, records, context);
    }
  }
  return [...records.values()];
}

function collectGeneratedAliasRecordDependencies(
  alias: TypeAliasDecl,
  records: Map<Str, RecordTypeRef>,
): void {
  if (alias.generated !== true) return;
  collectTypeRefChildRecordTypes(alias.type, records);
}

function collectTypeRefChildRecordTypes(type: TypeRef, records: Map<Str, RecordTypeRef>): void {
  if (type.kind !== "RecordTypeRef") {
    collectTypeRefRecordTypes(type, records);
    return;
  }
  for (const field of type.fields) collectTypeRefRecordTypes(field.type, records);
}

function collectStatementRecordTypes(
  statement: Statement,
  records: Map<Str, RecordTypeRef>,
  context: EmitContext,
): void {
  switch (statement.kind) {
    case "VarDeclStmt":
      collectVarDeclRecordTypes(statement, records, context);
      return;
    case "RecordRestStmt":
      collectRecordRestTypes(statement, records, context);
      return;
    case "SwitchStmt":
      for (const switchCase of statement.cases) {
        for (const child of switchCase.statements) {
          collectStatementRecordTypes(child, records, context);
        }
      }
      for (const child of statement.defaultCase?.statements ?? []) {
        collectStatementRecordTypes(child, records, context);
      }
      return;
    case "WhileStmt":
    case "DoWhileStmt":
    case "ForOfStmt":
    case "ForInStmt":
      for (const child of statement.body.statements) {
        collectStatementRecordTypes(child, records, context);
      }
      return;
    case "ForStmt":
      if (statement.initializer) {
        collectStatementRecordTypes(statement.initializer, records, context);
      }
      if (statement.update) collectStatementRecordTypes(statement.update, records, context);
      for (const child of statement.body.statements) {
        collectStatementRecordTypes(child, records, context);
      }
      return;
    case "IfStmt":
      for (const child of statement.thenBody.statements) {
        collectStatementRecordTypes(child, records, context);
      }
      for (const child of statement.elseBody?.statements ?? []) {
        collectStatementRecordTypes(child, records, context);
      }
      return;
    default:
      return;
  }
}

function collectVarDeclRecordTypes(
  statement: Extract<Statement, { kind: "VarDeclStmt" }>,
  records: Map<Str, RecordTypeRef>,
  context: EmitContext,
): void {
  if (statement.type !== null) {
    collectTypeRefRecordTypes(statement.type, records);
    return;
  }
  const inferredType = context.expressionTypes?.get(spanKey(statement.initializer.span))?.type ??
    "";
  const record = lookupRecordAlias(inferredType, new Map());
  if (record !== null) collectRecordType(record, records);
}

function collectRecordRestTypes(
  statement: Extract<Statement, { kind: "RecordRestStmt" }>,
  records: Map<Str, RecordTypeRef>,
  context: EmitContext,
): void {
  const sourceType = context.expressionTypes?.get(spanKey(statement.source.span))?.type ?? "";
  const sourceRecord = context.typeAliases.get(sourceType)?.type;
  if (sourceRecord?.kind !== "RecordTypeRef" || statement.restName === null) return;
  const fields = sourceRecord.fields.filter((field) => !statement.names.includes(field.name));
  collectRecordType({ kind: "RecordTypeRef", fields, span: statement.span }, records);
}

function collectTypeRefRecordTypes(type: TypeRef, records: Map<Str, RecordTypeRef>): void {
  switch (type.kind) {
    case "RecordTypeRef":
      collectRecordType(type, records);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeRefRecordTypes(type.element, records);
      return;
    case "TupleTypeRef":
      for (const element of type.elements) collectTypeRefRecordTypes(element, records);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectTypeRefRecordTypes(member, records);
      return;
    case "ConditionalTypeRef":
      collectTypeRefRecordTypes(type.checkType, records);
      collectTypeRefRecordTypes(type.extendsType, records);
      collectTypeRefRecordTypes(type.trueType, records);
      collectTypeRefRecordTypes(type.falseType, records);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeRefRecordTypes(param.type, records);
      collectTypeRefRecordTypes(type.returnType, records);
      return;
    case "NamedTypeRef":
      for (const typeArg of type.typeArgs ?? []) collectTypeRefRecordTypes(typeArg, records);
      return;
  }
}

function collectRecordType(type: RecordTypeRef, records: Map<Str, RecordTypeRef>): void {
  for (const field of type.fields) collectTypeRefRecordTypes(field.type, records);
  const name = recordCTypeName(type);
  if (!records.has(name)) records.set(name, type);
}

function recordMatchesMode(
  record: RecordTypeRef,
  generatedAliases: Set<Str>,
  mode: RecordDependencyMode,
): b8 {
  const dependsOnGeneratedOptional = recordDependsOnGeneratedOptional(record, generatedAliases);
  const dependsOnGeneratedAlias = recordDependsOnGeneratedAlias(record, generatedAliases);
  if (mode === "post-generated-optional") return dependsOnGeneratedOptional;
  if (mode === "post-generated-alias") {
    return dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
  }
  return !dependsOnGeneratedAlias && !dependsOnGeneratedOptional;
}

function recordDependsOnGeneratedAlias(record: RecordTypeRef, generatedAliases: Set<Str>): b8 {
  return record.fields.some((field) => typeContainsGeneratedAlias(field.type, generatedAliases));
}

function recordDependsOnGeneratedOptional(record: RecordTypeRef, generatedAliases: Set<Str>): b8 {
  return record.fields.some((field) =>
    typeDependsOnGeneratedOptional(field.type, generatedAliases)
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

function emitRecordTypeDefinition(type: RecordTypeRef, context: EmitContext): Str {
  const fields = type.fields.map((field) =>
    `  ${emitCDeclarator(field.type, field.name, context.typeAliases)};`
  );
  return [`typedef struct ${recordCTypeName(type)} {`, ...fields, `} ${recordCTypeName(type)};`]
    .join("\n");
}
