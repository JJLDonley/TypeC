import type { Expression, Statement } from "core/ast.ts";
import { cStringByteLength } from "core/c_strings.ts";
import { emitCType } from "c/type.ts";
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
  const out: Str[] = [];
  out.push(`if (${emitExpression(stmt.condition, context)}) {`);
  const thenLocals = new Map(locals);
  for (const child of stmt.thenBody.statements) {
    out.push(`  ${emitStatement(child, returnType, context, thenLocals)}`);
  }
  if (!stmt.elseBody) {
    out.push("}");
    return out.join("\n  ");
  }
  out.push("} else {");
  const elseLocals = new Map(locals);
  for (const child of stmt.elseBody.statements) {
    out.push(`  ${emitStatement(child, returnType, context, elseLocals)}`);
  }
  out.push("}");
  return out.join("\n  ");
}

function emitWhile(
  stmt: Extract<Statement, { kind: "WhileStmt" }>,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
): Str {
  const out: Str[] = [];
  out.push(`while (${emitExpression(stmt.condition, context)}) {`);
  const bodyLocals = new Map(locals);
  for (const child of stmt.body.statements) {
    out.push(`  ${emitStatement(child, returnType, context, bodyLocals)}`);
  }
  out.push("}");
  return out.join("\n  ");
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
