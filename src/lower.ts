import type {
  AssignmentStmt,
  BlockStmt,
  FunctionDecl,
  IfStmt,
  ImportDecl,
  Param,
  Program,
  Statement,
  TypeAliasDecl,
  VarDeclStmt,
  WhileStmt,
} from "./ast.ts";
import type {
  CastAssignmentStmt,
  CastBlockStmt,
  CastFunctionDecl,
  CastIfStmt,
  CastImportDecl,
  CastParam,
  CastProgram,
  CastStatement,
  CastTypeAliasDecl,
  CastVarDeclStmt,
  CastWhileStmt,
} from "./cast.ts";
import { lowerExpression } from "./lower_expressions.ts";
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


function lowerBlockStmt(block: CastBlockStmt): BlockStmt {
  return {
    kind: "BlockStmt",
    statements: block.statements.map(lowerStatement),
    span: block.span,
  };
}

function lowerStatement(statement: CastStatement): Statement {
  switch (statement.kind) {
    case "ReturnStmt":
      return { kind: "ReturnStmt", expression: statement.expression ? lowerExpression(statement.expression) : null, span: statement.span };
    case "VarDeclStmt":
      return lowerVarDeclStmt(statement);
    case "AssignmentStmt":
      return lowerAssignmentStmt(statement);
    case "WhileStmt":
      return lowerWhileStmt(statement);
    case "IfStmt":
      return lowerIfStmt(statement);
  }
}

function lowerIfStmt(statement: CastIfStmt): IfStmt {
  return {
    kind: "IfStmt",
    condition: lowerExpression(statement.condition),
    thenBody: lowerBlockStmt(statement.thenBody),
    elseBody: statement.elseBody ? lowerBlockStmt(statement.elseBody) : null,
    span: statement.span,
  };
}

function lowerAssignmentStmt(statement: CastAssignmentStmt): AssignmentStmt {
  return { kind: "AssignmentStmt", name: statement.name, expression: lowerExpression(statement.expression), span: statement.span };
}

function lowerWhileStmt(statement: CastWhileStmt): WhileStmt {
  return { kind: "WhileStmt", condition: lowerExpression(statement.condition), body: lowerBlockStmt(statement.body), span: statement.span };
}

function lowerVarDeclStmt(statement: CastVarDeclStmt): VarDeclStmt {
  return {
    kind: "VarDeclStmt",
    mutable: statement.mutable,
    name: statement.name,
    type: lowerTypeRef(statement.type),
    initializer: lowerExpression(statement.initializer),
    span: statement.span,
  };
}

