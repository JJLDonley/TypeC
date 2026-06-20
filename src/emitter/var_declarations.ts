import type { Statement } from "core/ast.ts";
import { emitCDeclarator, emitCType } from "c/type.ts";
import { emitArrayVarDecl } from "emitter/array_var_declarations.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

type VarDeclStatement = Extract<Statement, { kind: "VarDeclStmt" }>;

export function emitVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  if (isArrayVarDecl(stmt)) return emitArrayVarDecl(stmt, context);
  return emitScalarVarDecl(stmt, context);
}

function emitScalarVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  const expectedType = expectedInitializerType(stmt, context);
  return `${constPrefix(stmt)}${emitCDeclarator(stmt.type, stmt.name, context.typeAliases)} = ${
    emitExpressionExpected(stmt.initializer, expectedType, context)
  };`;
}

function expectedInitializerType(stmt: VarDeclStatement, context: EmitContext): Str {
  if (stmt.type.kind === "FunctionTypeRef") return typeName(stmt.type);
  return emitCType(stmt.type, context.typeAliases);
}

function isArrayVarDecl(stmt: VarDeclStatement): b8 {
  return stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef";
}

function constPrefix(stmt: VarDeclStatement): Str {
  return stmt.mutable ? "" : "const ";
}
