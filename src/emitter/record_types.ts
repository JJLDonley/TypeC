import type { Program, RecordTypeRef, Statement, TypeRef } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { recordCTypeName } from "c/records.ts";
import { emitCDeclarator } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function expectedRecordType(typeName: Str, context: EmitContext): RecordTypeRef | null {
  const alias = context.typeAliases.get(typeName) ??
    [...context.typeAliases.values()].find((candidate) => candidate.cName === typeName) ?? null;
  return alias?.type.kind === "RecordTypeRef" ? alias.type : null;
}

export function collectRecordTypeDefinitions(program: Program, context: EmitContext): Str[] {
  return collectRecordTypes(program, context).map((record) =>
    emitRecordTypeDefinition(record, context)
  );
}

function collectRecordTypes(program: Program, context: EmitContext): RecordTypeRef[] {
  const records = new Map<Str, RecordTypeRef>();
  for (const fn of program.functions) {
    for (const statement of fn.body?.statements ?? []) {
      collectStatementRecordTypes(statement, records, context);
    }
  }
  return [...records.values()];
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

function emitRecordTypeDefinition(type: RecordTypeRef, context: EmitContext): Str {
  const fields = type.fields.map((field) =>
    `  ${emitCDeclarator(field.type, field.name, context.typeAliases)};`
  );
  return [`typedef struct ${recordCTypeName(type)} {`, ...fields, `} ${recordCTypeName(type)};`]
    .join("\n");
}
