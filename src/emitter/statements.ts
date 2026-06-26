import type { RecordTypeRef, Statement } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { normalizeInferredLocalType } from "checker/inferred_local_types.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { recordCTypeName } from "c/records.ts";
import {
  parseArrayTypeName,
  parseSliceTypeName,
  parseTupleTypeName,
} from "checker/type_name_shapes.ts";
import { enumMemberSymbolName } from "core/enums.ts";
import { emitAssignment } from "emitter/assignments.ts";
import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";
import { emitConstantExpressionExpected } from "emitter/constant_expressions.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import { emitExpressionStatement } from "emitter/expression_statements.ts";
import { emitIncDec } from "emitter/inc_dec.ts";
import {
  childLocalTypes,
  type LocalTypes,
  registerLocalType,
  registerLocalTypeName,
} from "emitter/local_types.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { emitCType } from "c/type.ts";
import { emitVarDecl } from "emitter/var_declarations.ts";
import { typeRefFromTypeName } from "checker/type_name_type_refs.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type DeferredCalls = Str[];

interface DeferredContext {
  returnDefers: DeferredCalls;
  breakDefers: DeferredCalls;
  continueDefers: DeferredCalls;
}

type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;

export function emitStatements(
  statements: Statement[],
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes = new Map(),
  outerDefers: DeferredContext = emptyDeferredContext(),
): Str[] {
  const out: Str[] = [];
  const localDefers: DeferredCalls = [];
  for (const statement of statements) {
    if (statement.kind === "DeferStmt") {
      localDefers.push(emitDeferredCall(statement, context));
      continue;
    }
    out.push(
      ...emitStatementWithDefers(
        statement,
        returnType,
        context,
        locals,
        activeDeferredContext(localDefers, outerDefers),
      ),
    );
    if (statementExitsScope(statement)) return out;
  }
  out.push(...activeDefers(localDefers, []));
  return out;
}

function statementExitsScope(statement: Statement): b8 {
  switch (statement.kind) {
    case "ReturnStmt":
    case "BreakStmt":
    case "ContinueStmt":
      return true;
    case "IfStmt":
      return statement.elseBody !== null &&
        statementsExitScope(statement.thenBody.statements) &&
        statementsExitScope(statement.elseBody.statements);
    default:
      return false;
  }
}

function statementsExitScope(statements: Statement[]): b8 {
  for (const statement of statements) {
    if (statement.kind === "DeferStmt") continue;
    return statementExitsScope(statement);
  }
  return false;
}

export function emitStatement(
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes = new Map(),
): Str {
  return emitStatementWithDefers(
    stmt,
    returnType,
    context,
    locals,
    emptyDeferredContext(),
  ).join("\n");
}

function emitStatementWithDefers(
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  defers: DeferredContext,
): Str[] {
  switch (stmt.kind) {
    case "EmptyStmt":
      return [";"];
    case "ReturnStmt":
      return emitReturnWithDefers(stmt, returnType, context, defers.returnDefers);
    case "DeferStmt":
      return [];
    case "ExpressionStmt":
      return [emitExpressionStatement(stmt, context)];
    case "BreakStmt":
      return [...defers.breakDefers, "break;"];
    case "ContinueStmt":
      return [...defers.continueDefers, "continue;"];
    case "VarDeclStmt":
      registerVarDeclLocalType(locals, stmt, context);
      return [emitVarDecl(stmt, context)];
    case "RecordRestStmt":
      return emitRecordRest(stmt, context, locals);
    case "ArrayDestructureStmt":
      return emitArrayDestructure(stmt, context, locals);
    case "AssignmentStmt":
      return [emitAssignment(stmt, context, locals)];
    case "IncDecStmt":
      return [emitIncDec(stmt, context)];
    case "SwitchStmt":
      return [emitSwitchWithDefers(stmt, returnType, context, locals, defers)];
    case "WhileStmt":
      return [emitWhileWithDefers(stmt, returnType, context, locals, defers)];
    case "DoWhileStmt":
      return [emitDoWhileWithDefers(stmt, returnType, context, locals, defers)];
    case "ForStmt":
      return [emitForWithDefers(stmt, returnType, context, locals, defers)];
    case "ForOfStmt":
      return [emitForOfWithDefers(stmt, returnType, context, locals, defers)];
    case "ForInStmt":
      return [emitForInWithDefers(stmt, returnType, context, locals, defers)];
    case "IfStmt":
      return [emitIfWithDefers(stmt, returnType, context, locals, defers)];
  }
}

function registerVarDeclLocalType(
  locals: LocalTypes,
  stmt: Extract<Statement, { kind: "VarDeclStmt" }>,
  context: EmitContext,
): void {
  if (stmt.type !== null) {
    registerLocalType(locals, stmt.name, stmt.type, context.typeAliases);
    return;
  }
  const type = context.expressionTypes?.get(spanKey(stmt.initializer.span))?.type ?? "<error>";
  registerLocalTypeName(locals, stmt.name, inferredLocalCType(normalizeInferredLocalType(type)));
}

function inferredLocalCType(type: Str): Str {
  const record = lookupRecordAlias(type, new Map());
  return record === null ? type : recordCTypeName(record);
}

function emitArrayDestructure(
  stmt: Extract<Statement, { kind: "ArrayDestructureStmt" }>,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  const sourceType = context.expressionTypes?.get(spanKey(stmt.source.span))?.type ?? "";
  const tuple = parseTupleTypeName(sourceType);
  const source = emitExpression(stmt.source, context);
  if (tuple !== null) return emitTupleDestructure(stmt, tuple.elements, source, context, locals);
  const array = parseArrayTypeName(sourceType);
  if (array !== null) {
    return emitFixedArrayDestructure(stmt, array.element, source, context, locals);
  }
  return [];
}

function emitTupleDestructure(
  stmt: Extract<Statement, { kind: "ArrayDestructureStmt" }>,
  elements: Str[],
  source: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  return stmt.names.flatMap((name, index) => {
    const element = elements[index] ?? null;
    if (element === null) return [];
    registerLocalTypeName(locals, name, element);
    return [
      `${mutablePrefix(stmt.mutable)}${
        emitTypeNameDeclarator(element, name, stmt, context)
      } = ${source}._${index};`,
    ];
  });
}

function emitFixedArrayDestructure(
  stmt: Extract<Statement, { kind: "ArrayDestructureStmt" }>,
  element: Str,
  source: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  return stmt.names.map((name, index) => {
    registerLocalTypeName(locals, name, element);
    return `${mutablePrefix(stmt.mutable)}${
      emitTypeNameDeclarator(element, name, stmt, context)
    } = ${source}[${index}];`;
  });
}

function mutablePrefix(mutable: b8): Str {
  return mutable ? "" : "const ";
}

function emitTypeNameDeclarator(
  type: Str,
  name: Str,
  stmt: Extract<Statement, { kind: "ArrayDestructureStmt" }>,
  context: EmitContext,
): Str {
  return `${emitCTypeName(typeRefFromTypeName(type, stmt.span), context.typeAliases)} ${name}`;
}

function emitRecordRest(
  stmt: Extract<Statement, { kind: "RecordRestStmt" }>,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  const sourceType = context.expressionTypes?.get(spanKey(stmt.source.span))?.type ?? "";
  const sourceRecord = context.typeAliases.get(sourceType)?.type;
  if (sourceRecord?.kind !== "RecordTypeRef") return [];
  const source = emitExpression(stmt.source, context);
  const out = stmt.names.flatMap((name) =>
    emitRecordBinding(name, stmt.mutable, source, sourceRecord, context, locals)
  );
  if (stmt.restName !== null) {
    out.push(
      emitRecordRestBinding(
        stmt.restName,
        stmt.mutable,
        stmt.names,
        source,
        sourceRecord,
        context,
        locals,
      ),
    );
  }
  return out;
}

function emitRecordBinding(
  name: Str,
  mutable: b8,
  source: Str,
  record: RecordTypeRef,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  const field = record.fields.find((candidate) => candidate.name === name) ?? null;
  if (field === null) return [];
  registerLocalType(locals, name, field.type, context.typeAliases);
  return [
    `${mutable ? "" : "const "}${
      emitCDeclaratorCompat(field.type, name, context)
    } = ${source}.${name};`,
  ];
}

function emitRecordRestBinding(
  name: Str,
  mutable: b8,
  names: Str[],
  source: Str,
  record: RecordTypeRef,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const fields = record.fields.filter((field) => !names.includes(field.name));
  const type: RecordTypeRef = { kind: "RecordTypeRef", fields, span: record.span };
  registerLocalType(locals, name, type, context.typeAliases);
  const values = fields.map((field) => `.${field.name} = ${source}.${field.name}`).join(", ");
  return `${mutable ? "" : "const "}${emitCType(type, context.typeAliases)} ${name} = (${
    emitCType(type, context.typeAliases)
  }){ ${values} };`;
}

function emitCDeclaratorCompat(
  type: RecordTypeRef["fields"][usize]["type"],
  name: Str,
  context: EmitContext,
): Str {
  return `${emitCTypeName(type, context.typeAliases)} ${name}`;
}

function emitReturnWithDefers(
  stmt: Extract<Statement, { kind: "ReturnStmt" }>,
  returnType: Str,
  context: EmitContext,
  defers: DeferredCalls,
): Str[] {
  if (stmt.expression === null) return [...defers, "return;"];
  const value = emitExpressionExpected(stmt.expression, returnType, context);
  if (defers.length === 0) return [`return ${value};`];
  const temp = returnTempName(stmt);
  return [`${returnType} ${temp} = ${value};`, ...defers, `return ${temp};`];
}

function returnTempName(stmt: Extract<Statement, { kind: "ReturnStmt" }>): Str {
  return `__typec_return_${stmt.span.start.offset}`;
}

function emitDeferredCall(
  stmt: Extract<Statement, { kind: "DeferStmt" }>,
  context: EmitContext,
): Str {
  return `${emitExpression(stmt.expression, context)};`;
}

function activeDefers(localDefers: DeferredCalls, outerDefers: DeferredCalls): DeferredCalls {
  return [...localDefers].reverse().concat(outerDefers);
}

function activeDeferredContext(
  localDefers: DeferredCalls,
  outerDefers: DeferredContext,
): DeferredContext {
  return {
    returnDefers: activeDefers(localDefers, outerDefers.returnDefers),
    breakDefers: activeDefers(localDefers, outerDefers.breakDefers),
    continueDefers: activeDefers(localDefers, outerDefers.continueDefers),
  };
}

function emptyDeferredContext(): DeferredContext {
  return { returnDefers: [], breakDefers: [], continueDefers: [] };
}

function breakableDeferredContext(defers: DeferredContext): DeferredContext {
  return {
    returnDefers: defers.returnDefers,
    breakDefers: [],
    continueDefers: defers.continueDefers,
  };
}

function loopDeferredContext(
  defers: DeferredContext,
  continueDefers: DeferredCalls,
): DeferredContext {
  return {
    returnDefers: defers.returnDefers,
    breakDefers: [],
    continueDefers,
  };
}

function emitIfWithDefers(
  stmt: Extract<Statement, { kind: "IfStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const thenBody = emitChildStatements(
    stmt.thenBody.statements,
    returnType,
    context,
    locals,
    outerDefers,
  );
  const header = `if (${emitExpression(stmt.condition, context)}) {`;
  if (!stmt.elseBody) return emitBracedBlock(header, thenBody);
  const elseBody = emitChildStatements(
    stmt.elseBody.statements,
    returnType,
    context,
    locals,
    outerDefers,
  );
  return emitIfElseBlock(header, thenBody, elseBody);
}

function emitWhileWithDefers(
  stmt: Extract<Statement, { kind: "WhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const body = emitChildStatements(
    stmt.body.statements,
    returnType,
    context,
    locals,
    loopDeferredContext(outerDefers, []),
  );
  return emitBracedBlock(`while (${emitExpression(stmt.condition, context)}) {`, body);
}

function emitDoWhileWithDefers(
  stmt: Extract<Statement, { kind: "DoWhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const body = emitChildStatements(
    stmt.body.statements,
    returnType,
    context,
    locals,
    loopDeferredContext(outerDefers, []),
  );
  return [
    ...emitBracedBlock("do {", body).split("\n"),
    `while (${emitExpression(stmt.condition, context)});`,
  ]
    .join("\n");
}

function emitForWithDefers(
  stmt: Extract<Statement, { kind: "ForStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const loopLocals = childLocalTypes(locals);
  const lines: Str[] = ["{"];
  if (stmt.initializer) lines.push(`  ${emitForClause(stmt.initializer, context, loopLocals)}`);
  const update = stmt.update ? emitForClause(stmt.update, context, loopLocals) : null;
  const body = emitChildStatements(
    stmt.body.statements,
    returnType,
    context,
    loopLocals,
    loopDeferredContext(outerDefers, update ? [update] : []),
  );
  if (update) body.push(update);
  lines.push(
    ...emitBracedBlock(`while (${emitExpression(stmt.condition, context)}) {`, body).split("\n")
      .map(indentCaseLine),
  );
  lines.push("}");
  return lines.join("\n");
}

function emitForClause(
  stmt: Extract<Statement, { kind: "ForStmt" }>["initializer"] & {},
  context: EmitContext,
  locals: LocalTypes,
): Str {
  switch (stmt.kind) {
    case "VarDeclStmt":
      registerVarDeclLocalType(locals, stmt, context);
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return emitAssignment(stmt, context, locals);
    case "IncDecStmt":
      return emitIncDec(stmt, context);
    case "ExpressionStmt":
      return emitExpressionStatement(stmt, context);
  }
}

function emitForOfWithDefers(
  stmt: Extract<Statement, { kind: "ForOfStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const loopLocals = childLocalTypes(locals);
  const index = forOfIndexName(stmt);
  const itemType = forOfItemCType(stmt, context);
  loopLocals.set(stmt.name, itemType);
  const update = `${index}++;`;
  const body = emitChildStatements(
    stmt.body.statements,
    returnType,
    context,
    loopLocals,
    loopDeferredContext(outerDefers, [update]),
  );
  body.unshift(
    `${stmt.mutable ? "" : "const "}${itemType} ${stmt.name} = ${forOfItem(stmt, index, context)};`,
  );
  body.push(update);
  return [
    "{",
    `  usize ${index} = 0;`,
    ...emitBracedBlock(`while (${index} < ${forOfLength(stmt, context)}) {`, body).split("\n")
      .map(indentCaseLine),
    "}",
  ].join("\n");
}

function forOfIndexName(stmt: Extract<Statement, { kind: "ForOfStmt" }>): Str {
  return `__typec_for_of_${stmt.span.start.offset}`;
}

function forOfItemCType(
  stmt: Extract<Statement, { kind: "ForOfStmt" }>,
  context: EmitContext,
): Str {
  const iterableType = forOfIterableType(stmt, context);
  return forOfElementType(iterableType);
}

function forOfElementType(iterableType: Str): Str {
  const array = parseArrayTypeName(iterableType);
  if (array !== null) return array.element;
  const slice = parseSliceTypeName(iterableType);
  if (slice !== null) return slice.element;
  return "<error>";
}

function forOfLength(stmt: Extract<Statement, { kind: "ForOfStmt" }>, context: EmitContext): Str {
  const iterableType = forOfIterableType(stmt, context);
  const array = parseArrayTypeName(iterableType);
  if (array?.length !== null && array !== null) return `${array.length}`;
  return `${emitExpression(stmt.iterable, context)}.length`;
}

function forOfItem(
  stmt: Extract<Statement, { kind: "ForOfStmt" }>,
  index: Str,
  context: EmitContext,
): Str {
  const iterable = emitExpression(stmt.iterable, context);
  if (parseSliceTypeName(forOfIterableType(stmt, context)) !== null) {
    return `${iterable}.data[${index}]`;
  }
  return `${iterable}[${index}]`;
}

function forOfIterableType(
  stmt: Extract<Statement, { kind: "ForOfStmt" }>,
  context: EmitContext,
): Str {
  return context.expressionTypes?.get(spanKey(stmt.iterable.span))?.type ?? "<error>";
}

function emitForInWithDefers(
  stmt: Extract<Statement, { kind: "ForInStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  return ["{", ...forInCases(stmt, returnType, context, locals, outerDefers), "}"].join("\n");
}

function forInCases(
  stmt: Extract<Statement, { kind: "ForInStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str[] {
  const values = forInValues(stmt, context);
  return values.flatMap((value) =>
    forInCase(stmt, value, returnType, context, locals, outerDefers)
  );
}

function forInCase(
  stmt: Extract<Statement, { kind: "ForInStmt" }>,
  value: Str,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str[] {
  const caseLocals = childLocalTypes(locals);
  caseLocals.set(stmt.name, forInKeyType(stmt, context));
  const declaration = `const ${forInKeyType(stmt, context)} ${stmt.name} = ${value};`;
  return emitBracedBlock("{", [
    declaration,
    ...emitChildStatements(
      stmt.body.statements,
      returnType,
      context,
      caseLocals,
      outerDefers,
    ),
  ]).split("\n").map(indentCaseLine);
}

function forInValues(stmt: Extract<Statement, { kind: "ForInStmt" }>, context: EmitContext): Str[] {
  const enumDecl = forInEnum(stmt, context);
  if (enumDecl !== null) {
    return enumDecl.members.map((member) =>
      context.constants?.get(enumMemberSymbolName(enumDecl.name, member.name))?.cName ??
        `${enumDecl.name}_${member.name}`
    );
  }
  const record = forInRecord(stmt, context);
  return record?.fields.map((field) => `"${field.name}"`) ?? [];
}

function forInKeyType(stmt: Extract<Statement, { kind: "ForInStmt" }>, context: EmitContext): Str {
  const enumDecl = forInEnum(stmt, context);
  return enumDecl?.cName ?? enumDecl?.name ?? "u8*";
}

function forInEnum(stmt: Extract<Statement, { kind: "ForInStmt" }>, context: EmitContext) {
  if (stmt.iterable.kind !== "IdentifierExpr") return null;
  const name = stmt.iterable.name;
  return context.program?.enums?.find((enumDecl) => enumDecl.name === name) ?? null;
}

function forInRecord(stmt: Extract<Statement, { kind: "ForInStmt" }>, context: EmitContext) {
  const type = context.expressionTypes?.get(spanKey(stmt.iterable.span))?.type ?? null;
  if (type === null) return null;
  const alias = context.typeAliases.get(type) ?? null;
  return alias?.type.kind === "RecordTypeRef" ? alias.type : null;
}

function emitSwitchWithDefers(
  stmt: SwitchStmt,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str {
  const lines: Str[] = [`switch (${emitExpression(stmt.expression, context)}) {`];
  const labelType = switchLabelType(stmt, context);
  const caseDefers = breakableDeferredContext(outerDefers);
  for (const switchCase of stmt.cases) {
    for (const label of switchCase.labels) {
      lines.push(`case ${emitConstantExpressionExpected(label, labelType, context)}:`);
    }
    lines.push(
      ...emitChildStatements(switchCase.statements, returnType, context, locals, caseDefers).map(
        indentCaseLine,
      ),
    );
  }
  if (stmt.defaultCase) {
    lines.push("default:");
    lines.push(
      ...emitChildStatements(stmt.defaultCase.statements, returnType, context, locals, caseDefers)
        .map(indentCaseLine),
    );
  }
  lines.push("}");
  return lines.join("\n");
}

function emitChildStatements(
  statements: Statement[],
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  outerDefers: DeferredContext,
): Str[] {
  return emitStatements(statements, returnType, context, childLocalTypes(locals), outerDefers);
}

function indentCaseLine(line: Str): Str {
  return `  ${line}`;
}

function switchLabelType(stmt: SwitchStmt, context: EmitContext): Str {
  const type = context.expressionTypes?.get(spanKey(stmt.expression.span))?.type ?? "i32";
  const alias = context.typeAliases.get(type)?.type ?? null;
  if (alias !== null) return emitCTypeName(alias, context.typeAliases);
  return type;
}
