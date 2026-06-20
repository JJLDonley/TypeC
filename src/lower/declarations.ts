import type { ConstDecl, FunctionDecl, ImportDecl, Param, TypeAliasDecl } from "core/ast.ts";
import type {
  CastConstDecl,
  CastFunctionDecl,
  CastImportDecl,
  CastParam,
  CastTypeAliasDecl,
} from "core/cast.ts";
import { lowerExpression } from "lower/expressions.ts";
import { lowerBlockStmt } from "lower/statements.ts";
import { lowerTypeRef } from "lower/types.ts";

export function lowerImportDecl(importDecl: CastImportDecl): ImportDecl {
  return {
    kind: "ImportDecl",
    names: importDecl.names,
    namespace: importDecl.namespace,
    path: importDecl.path,
    span: importDecl.span,
  };
}

export function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    cName: typeAlias.cName,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

export function lowerConstDecl(constant: CastConstDecl): ConstDecl {
  return {
    kind: "ConstDecl",
    exported: constant.exported,
    name: constant.name,
    cName: constant.cName,
    type: lowerTypeRef(constant.type),
    initializer: lowerExpression(constant.initializer),
    span: constant.span,
  };
}

export function lowerFunctionDecl(fn: CastFunctionDecl): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: fn.exported,
    external: fn.external,
    name: fn.name,
    cName: fn.cName,
    params: fn.params.map(lowerParam),
    variadic: fn.variadic,
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
