import type { FunctionDecl, ImportDecl, Param, TypeAliasDecl } from "core/ast.ts";
import type { CastFunctionDecl, CastImportDecl, CastParam, CastTypeAliasDecl } from "core/cast.ts";
import { lowerBlockStmt } from "lower/statements.ts";
import { lowerTypeRef } from "lower/types.ts";

export function lowerImportDecl(importDecl: CastImportDecl): ImportDecl {
  return { kind: "ImportDecl", names: importDecl.names, path: importDecl.path, span: importDecl.span };
}

export function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

export function lowerFunctionDecl(fn: CastFunctionDecl): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: fn.exported,
    external: fn.external,
    name: fn.name,
    params: fn.params.map(lowerParam),
    returnType: lowerTypeRef(fn.returnType),
    body: fn.body ? lowerBlockStmt(fn.body) : null,
    span: fn.span,
  };
}

function lowerParam(param: CastParam): Param {
  return {
    name: param.name,
    type: lowerTypeRef(param.type),
    span: param.span,
  };
}
