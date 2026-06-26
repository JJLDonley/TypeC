import type { Statement } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { normalizeInferredLocalType } from "checker/inferred_local_types.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { optionalTypeNameElement, parseArrayTypeName } from "checker/type_name_shapes.ts";
import { optionalCTypeNameFromTypeName } from "c/optional_names.ts";
import { recordCTypeName } from "c/records.ts";
import { emitCDeclarator, emitCType } from "c/type.ts";
import { emitArrayVarDecl } from "emitter/array_var_declarations.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";
import { emitTypeNameDeclarator } from "emitter/type_name_declarators.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

type VarDeclStatement = Extract<Statement, { kind: "VarDeclStmt" }>;

export function emitVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  if (isArrayVarDecl(stmt, context)) return emitArrayVarDecl(stmt, context);
  return emitScalarVarDecl(stmt, context);
}

function emitScalarVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  const expectedType = expectedInitializerType(stmt, context);
  return `${constPrefix(stmt)}${declarator(stmt, expectedType, context)} = ${
    emitExpressionExpected(stmt.initializer, expectedType, context)
  };`;
}

function declarator(stmt: VarDeclStatement, expectedType: Str, context: EmitContext): Str {
  if (stmt.type === null) return emitTypeNameDeclarator(expectedType, stmt.name);
  return emitCDeclarator(stmt.type, stmt.name, context.typeAliases);
}

function expectedInitializerType(stmt: VarDeclStatement, context: EmitContext): Str {
  if (stmt.type === null) return inferredInitializerCType(stmt, context);
  if (stmt.type.kind === "FunctionTypeRef" || stmt.type.kind === "TupleTypeRef") {
    return typeName(stmt.type);
  }
  return emitCType(stmt.type, context.typeAliases);
}

function inferredInitializerType(stmt: VarDeclStatement, context: EmitContext): Str {
  const type = context.expressionTypes?.get(spanKey(stmt.initializer.span))?.type ?? "<error>";
  return normalizeInferredLocalType(type);
}

function inferredInitializerCType(stmt: VarDeclStatement, context: EmitContext): Str {
  const type = inferredInitializerType(stmt, context);
  const optional = optionalTypeNameElement(type);
  if (optional !== null) return optionalCTypeNameFromTypeName(optional);
  const record = lookupRecordAlias(type, new Map());
  return record === null ? type : recordCTypeName(record);
}

function isArrayVarDecl(stmt: VarDeclStatement, context: EmitContext): b8 {
  if (stmt.type?.kind === "InferredArrayTypeRef" || stmt.type?.kind === "FixedArrayTypeRef") {
    return true;
  }
  if (stmt.type !== null) return false;
  return parseArrayTypeName(inferredInitializerType(stmt, context)) !== null;
}

function constPrefix(stmt: VarDeclStatement): Str {
  return stmt.mutable ? "" : "const ";
}
