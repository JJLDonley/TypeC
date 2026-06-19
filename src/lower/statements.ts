import type { AssignmentStmt, BlockStmt, IfStmt, Statement, VarDeclStmt, WhileStmt } from "core/ast.ts";
import type { CastAssignmentStmt, CastBlockStmt, CastIfStmt, CastStatement, CastVarDeclStmt, CastWhileStmt } from "core/cast.ts";
import { lowerExpression } from "lower/expressions.ts";
import { lowerTypeRef } from "lower/types.ts";

export function lowerBlockStmt(block: CastBlockStmt): BlockStmt {
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
