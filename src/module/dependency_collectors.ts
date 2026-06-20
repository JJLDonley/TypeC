import type {
  BlockStmt,
  ConstDecl,
  Expression,
  FunctionDecl,
  Statement,
  TypeAliasDecl,
  TypeRef,
} from "core/ast.ts";
import type { DependencySet } from "module/dependency_index.ts";

export function collectTypeAliasDeps(
  typeAlias: TypeAliasDecl | undefined,
  selected: DependencySet,
): void {
  if (!typeAlias) return;
  collectTypeDeps(typeAlias.type, selected);
}

export function collectConstDeps(constant: ConstDecl | undefined, selected: DependencySet): void {
  if (!constant) return;
  collectTypeDeps(constant.type, selected);
  collectExpressionDeps(constant.initializer, selected);
}

export function collectFunctionDeps(fn: FunctionDecl | undefined, selected: DependencySet): void {
  if (!fn) return;
  for (const param of fn.params) collectTypeDeps(param.type, selected);
  collectTypeDeps(fn.returnType, selected);
  if (fn.body) collectBlockDeps(fn.body, selected);
}

function collectBlockDeps(block: BlockStmt, selected: DependencySet): void {
  for (const statement of block.statements) collectStatementDeps(statement, selected);
}

function collectStatementDeps(statement: Statement, selected: DependencySet): void {
  switch (statement.kind) {
    case "ReturnStmt":
      if (statement.expression) collectExpressionDeps(statement.expression, selected);
      return;
    case "ExpressionStmt":
      collectExpressionDeps(statement.expression, selected);
      return;
    case "VarDeclStmt":
      collectTypeDeps(statement.type, selected);
      collectExpressionDeps(statement.initializer, selected);
      return;
    case "AssignmentStmt":
      collectExpressionDeps(statement.expression, selected);
      return;
    case "WhileStmt":
      collectExpressionDeps(statement.condition, selected);
      collectBlockDeps(statement.body, selected);
      return;
    case "IfStmt":
      collectExpressionDeps(statement.condition, selected);
      collectBlockDeps(statement.thenBody, selected);
      if (statement.elseBody) collectBlockDeps(statement.elseBody, selected);
      return;
  }
}

function collectExpressionDeps(expression: Expression, selected: DependencySet): void {
  switch (expression.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
      return;
    case "IdentifierExpr":
      selected.constants.add(expression.name);
      return;
    case "UnaryExpr":
      collectExpressionDeps(expression.operand, selected);
      return;
    case "BinaryExpr":
      collectExpressionDeps(expression.left, selected);
      collectExpressionDeps(expression.right, selected);
      return;
    case "CallExpr":
      selected.functions.add(expression.callee);
      for (const arg of expression.args) collectExpressionDeps(arg, selected);
      return;
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
      collectExpressionDeps(expression.operand, selected);
      return;
    case "RecordLiteralExpr":
      for (const field of expression.fields) collectExpressionDeps(field.expression, selected);
      return;
    case "ArrayLiteralExpr":
      for (const element of expression.elements) collectExpressionDeps(element, selected);
      return;
    case "IndexExpr":
      collectExpressionDeps(expression.operand, selected);
      collectExpressionDeps(expression.index, selected);
      return;
  }
}

function collectTypeDeps(type: TypeRef, selected: DependencySet): void {
  switch (type.kind) {
    case "NamedTypeRef":
      selected.types.add(type.name);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeDeps(type.element, selected);
      return;
    case "SliceTypeRef":
      collectTypeDeps(type.element, selected);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeDeps(param.type, selected);
      collectTypeDeps(type.returnType, selected);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeDeps(field.type, selected);
      return;
  }
}
