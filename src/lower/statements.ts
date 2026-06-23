import type {
  AssignmentStmt,
  BlockStmt,
  ExpressionStmt,
  IfStmt,
  Statement,
  SwitchStmt,
  VarDeclStmt,
  WhileStmt,
} from "core/ast.ts";
import type {
  CastAssignmentStmt,
  CastBlockStmt,
  CastExpressionStmt,
  CastIfStmt,
  CastStatement,
  CastSwitchStmt,
  CastVarDeclStmt,
  CastWhileStmt,
} from "core/cast.ts";
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
      return {
        kind: "ReturnStmt",
        expression: statement.expression ? lowerExpression(statement.expression) : null,
        span: statement.span,
      };
    case "ExpressionStmt":
      return lowerExpressionStmt(statement);
    case "BreakStmt":
      return { kind: "BreakStmt", span: statement.span };
    case "VarDeclStmt":
      return lowerVarDeclStmt(statement);
    case "AssignmentStmt":
      return lowerAssignmentStmt(statement);
    case "SwitchStmt":
      return lowerSwitchStmt(statement);
    case "WhileStmt":
      return lowerWhileStmt(statement);
    case "IfStmt":
      return lowerIfStmt(statement);
  }
}

function lowerExpressionStmt(statement: CastExpressionStmt): ExpressionStmt {
  return {
    kind: "ExpressionStmt",
    expression: lowerExpression(statement.expression),
    span: statement.span,
  };
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
  return {
    kind: "AssignmentStmt",
    name: statement.name,
    expression: lowerExpression(statement.expression),
    span: statement.span,
  };
}

function lowerSwitchStmt(statement: CastSwitchStmt): SwitchStmt {
  return {
    kind: "SwitchStmt",
    expression: lowerExpression(statement.expression),
    cases: statement.cases.map((value) => ({
      labels: value.labels.map(lowerExpression),
      statements: value.statements.map(lowerStatement),
      span: value.span,
    })),
    defaultCase: statement.defaultCase
      ? {
        statements: statement.defaultCase.statements.map(lowerStatement),
        span: statement.defaultCase.span,
      }
      : null,
    span: statement.span,
  };
}

function lowerWhileStmt(statement: CastWhileStmt): WhileStmt {
  return {
    kind: "WhileStmt",
    condition: lowerExpression(statement.condition),
    body: lowerBlockStmt(statement.body),
    span: statement.span,
  };
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
