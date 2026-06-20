import type { Expression, Statement } from "core/ast.ts";
import { cStringByteLength } from "core/c_strings.ts";
import { emitCType } from "c/type.ts";
import { emitBracedBlock, emitIfElseBlock } from "emitter/blocks.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import { emitCStringLiteral } from "emitter/strings.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;
type LocalTypes = Map<Str, Str>;

export function emitStatement(
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes = new Map(),
): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression
        ? `return ${emitExpressionExpected(stmt.expression, returnType, context)};`
        : "return;";
    case "ExpressionStmt":
      return `${emitExpression(stmt.expression, context)};`;
    case "VarDeclStmt":
      locals.set(stmt.name, emitCTypeName(stmt.type, context.typeAliases));
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return emitAssignment(stmt, context, locals);
    case "WhileStmt":
      return emitWhile(stmt, returnType, context, locals);
    case "IfStmt":
      return emitIf(stmt, returnType, context, locals);
  }
}

function emitIf(
  stmt: Extract<Statement, { kind: "IfStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const header = `if (${emitExpression(stmt.condition, context)}) {`;
  const thenBody = emitChildStatements(stmt.thenBody.statements, returnType, context, locals);
  if (!stmt.elseBody) return emitBracedBlock(header, thenBody);
  const elseBody = emitChildStatements(stmt.elseBody.statements, returnType, context, locals);
  return emitIfElseBlock(header, thenBody, elseBody);
}

function emitWhile(
  stmt: Extract<Statement, { kind: "WhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const body = emitChildStatements(stmt.body.statements, returnType, context, locals);
  return emitBracedBlock(`while (${emitExpression(stmt.condition, context)}) {`, body);
}

function emitChildStatements(
  statements: Statement[],
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str[] {
  const childLocals = new Map(locals);
  return statements.map((child) => emitStatement(child, returnType, context, childLocals));
}

function emitAssignment(
  stmt: Extract<Statement, { kind: "AssignmentStmt" }>,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const targetType = locals.get(stmt.name);
  const expression = targetType
    ? emitExpressionExpected(stmt.expression, targetType, context)
    : emitExpression(stmt.expression, context);
  return `${stmt.name} = ${expression};`;
}

function emitVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, context: EmitContext): Str {
  if (stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef") {
    return emitArrayVarDecl(stmt, context);
  }
  return `${stmt.mutable ? "" : "const "}${
    emitCType(stmt.type, context.typeAliases)
  } ${stmt.name} = ${
    emitExpressionExpected(stmt.initializer, emitCType(stmt.type, context.typeAliases), context)
  };`;
}

function emitArrayVarDecl(
  stmt: Extract<Statement, { kind: "VarDeclStmt" }>,
  context: EmitContext,
): Str {
  if (stmt.initializer.kind === "StringLiteral") {
    return emitStringArrayVarDecl({ ...stmt, initializer: stmt.initializer }, context);
  }
  if (stmt.initializer.kind !== "ArrayLiteralExpr") {
    throw new Error("Array declarations require array-compatible literals");
  }
  const element =
    stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef"
      ? emitCType(stmt.type.element, context.typeAliases)
      : "";
  const length = stmt.type.kind === "FixedArrayTypeRef"
    ? stmt.type.sizeText
    : String(stmt.initializer.elements.length);
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${
    emitExpressionExpected(stmt.initializer, `${element}[${length}]`, context)
  };`;
}

function emitStringArrayVarDecl(
  stmt: Extract<Statement, { kind: "VarDeclStmt" }> & {
    initializer: Extract<Expression, { kind: "StringLiteral" }>;
  },
  context: EmitContext,
): Str {
  if (stmt.type.kind !== "InferredArrayTypeRef" && stmt.type.kind !== "FixedArrayTypeRef") {
    throw new Error("String array declarations require array types");
  }
  const element = emitCType(stmt.type.element, context.typeAliases);
  const length = stmt.type.kind === "FixedArrayTypeRef"
    ? stmt.type.sizeText
    : String(cStringByteLength(stmt.initializer.text));
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${
    emitCStringLiteral(stmt.initializer.text)
  };`;
}
