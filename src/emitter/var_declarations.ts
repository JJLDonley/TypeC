import type { Statement } from "core/ast.ts";
import { emitCType } from "c/type.ts";
import { emitArrayVarDecl } from "emitter/array_var_declarations.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";

type Str = string;
type b8 = boolean;

type VarDeclStatement = Extract<Statement, { kind: "VarDeclStmt" }>;

export function emitVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  if (isArrayVarDecl(stmt)) return emitArrayVarDecl(stmt, context);
  return emitScalarVarDecl(stmt, context);
}

function emitScalarVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  const type = emitCType(stmt.type, context.typeAliases);
  return `${constPrefix(stmt)}${type} ${stmt.name} = ${
    emitExpressionExpected(stmt.initializer, type, context)
  };`;
}

function isArrayVarDecl(stmt: VarDeclStatement): b8 {
  return stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef";
}

function constPrefix(stmt: VarDeclStatement): Str {
  return stmt.mutable ? "" : "const ";
}
