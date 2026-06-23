import type { Statement } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { emitAssignment } from "emitter/assignments.ts";
import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";
import { emitConstantExpressionExpected } from "emitter/constant_expressions.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import { emitExpressionStatement } from "emitter/expression_statements.ts";
import { emitIncDec } from "emitter/inc_dec.ts";
import { childLocalTypes, type LocalTypes, registerLocalType } from "emitter/local_types.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { emitVarDecl } from "emitter/var_declarations.ts";

export type Str = string;

type DeferredCalls = Str[];

interface DeferredContext {
  returnDefers: DeferredCalls;
  breakDefers: DeferredCalls;
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
  }
  out.push(...activeDefers(localDefers, []));
  return out;
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
    case "VarDeclStmt":
      registerLocalType(locals, stmt.name, stmt.type, context.typeAliases);
      return [emitVarDecl(stmt, context)];
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
    case "IfStmt":
      return [emitIfWithDefers(stmt, returnType, context, locals, defers)];
  }
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
  };
}

function emptyDeferredContext(): DeferredContext {
  return { returnDefers: [], breakDefers: [] };
}

function breakableDeferredContext(defers: DeferredContext): DeferredContext {
  return { returnDefers: defers.returnDefers, breakDefers: [] };
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
    breakableDeferredContext(outerDefers),
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
    breakableDeferredContext(outerDefers),
  );
  return [
    ...emitBracedBlock("do {", body).split("\n"),
    `while (${emitExpression(stmt.condition, context)});`,
  ]
    .join("\n");
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
