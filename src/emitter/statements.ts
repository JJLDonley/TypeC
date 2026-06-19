import type { Statement } from "core/ast.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";

type Str = string;

export function emitStatement(stmt: Statement, returnType: Str, context: EmitContext): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression ? `return ${emitExpressionExpected(stmt.expression, returnType, context)};` : "return;";
    case "VarDeclStmt":
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return `${stmt.name} = ${emitExpression(stmt.expression, context)};`;
    case "WhileStmt":
      return emitWhile(stmt, returnType, context);
    case "IfStmt":
      return emitIf(stmt, returnType, context);
  }
}

function emitIf(stmt: Extract<Statement, { kind: "IfStmt" }>, returnType: Str, context: EmitContext): Str {
  const out: Str[] = [];
  out.push(`if (${emitExpression(stmt.condition, context)}) {`);
  for (const child of stmt.thenBody.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  if (!stmt.elseBody) {
    out.push("}");
    return out.join("\n  ");
  }
  out.push("} else {");
  for (const child of stmt.elseBody.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitWhile(stmt: Extract<Statement, { kind: "WhileStmt" }>, returnType: Str, context: EmitContext): Str {
  const out: Str[] = [];
  out.push(`while (${emitExpression(stmt.condition, context)}) {`);
  for (const child of stmt.body.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, context: EmitContext): Str {
  if (stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef") return emitArrayVarDecl(stmt, context);
  return `${stmt.mutable ? "" : "const "}${emitCType(stmt.type)} ${stmt.name} = ${emitExpressionExpected(stmt.initializer, emitCType(stmt.type), context)};`;
}

function emitArrayVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, context: EmitContext): Str {
  if (stmt.initializer.kind !== "ArrayLiteralExpr") throw new Error("Array declarations require array literals");
  const element = stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef" ? emitCType(stmt.type.element) : "";
  const length = stmt.type.kind === "FixedArrayTypeRef" ? stmt.type.sizeText : String(stmt.initializer.elements.length);
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${emitExpressionExpected(stmt.initializer, `${element}[${length}]`, context)};`;
}
