import type {
  FunctionDecl,
  ImportDecl,
  Param,
  Program,
  TypeAliasDecl,
} from "./ast.ts";
import type {
  CastFunctionDecl,
  CastImportDecl,
  CastParam,
  CastProgram,
  CastTypeAliasDecl,
} from "./cast.ts";
import { lowerBlockStmt } from "./lower_statements.ts";
import { lowerTypeRef } from "./lower_types.ts";

export function lowerCast(program: CastProgram): Program {
  return {
    kind: "Program",
    imports: program.imports.map(lowerImportDecl),
    typeAliases: program.typeAliases.map(lowerTypeAliasDecl),
    functions: program.functions.map(lowerFunctionDecl),
    span: program.span,
  };
}

function lowerImportDecl(importDecl: CastImportDecl): ImportDecl {
  return { kind: "ImportDecl", names: importDecl.names, path: importDecl.path, span: importDecl.span };
}

function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

function lowerFunctionDecl(fn: CastFunctionDecl): FunctionDecl {
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


