import type { Expression, FunctionDecl, Program, Statement, TypeRef } from "core/ast.ts";

export type Str = string;

export function collectNamespaceMembers(program: Program, namespace: Str): Set<Str> {
  const members = new Set<Str>();
  for (const typeAlias of program.typeAliases) collectType(typeAlias.type, namespace, members);
  for (const constant of program.constants ?? []) {
    collectType(constant.type, namespace, members);
    collectExpression(constant.initializer, namespace, members);
  }
  for (const fn of program.functions) collectFunction(fn, namespace, members);
  return members;
}

function collectFunction(fn: FunctionDecl, namespace: Str, members: Set<Str>): void {
  for (const param of fn.params) collectType(param.type, namespace, members);
  collectType(fn.returnType, namespace, members);
  if (!fn.body) return;
  for (const statement of fn.body.statements) collectStatement(statement, namespace, members);
}

function collectStatement(statement: Statement, namespace: Str, members: Set<Str>): void {
  switch (statement.kind) {
    case "ReturnStmt":
      if (statement.expression) collectExpression(statement.expression, namespace, members);
      return;
    case "DeferStmt":
    case "ExpressionStmt":
      collectExpression(statement.expression, namespace, members);
      return;
    case "BreakStmt":
      return;
    case "VarDeclStmt":
      collectType(statement.type, namespace, members);
      collectExpression(statement.initializer, namespace, members);
      return;
    case "AssignmentStmt":
      collectExpression(statement.expression, namespace, members);
      return;
    case "SwitchStmt":
      collectExpression(statement.expression, namespace, members);
      for (const switchCase of statement.cases) {
        for (const label of switchCase.labels) collectExpression(label, namespace, members);
        for (const child of switchCase.statements) collectStatement(child, namespace, members);
      }
      for (const child of statement.defaultCase?.statements ?? []) {
        collectStatement(child, namespace, members);
      }
      return;
    case "WhileStmt":
      collectExpression(statement.condition, namespace, members);
      for (const child of statement.body.statements) collectStatement(child, namespace, members);
      return;
    case "IfStmt":
      collectExpression(statement.condition, namespace, members);
      for (const child of statement.thenBody.statements) {
        collectStatement(child, namespace, members);
      }
      for (const child of statement.elseBody?.statements ?? []) {
        collectStatement(child, namespace, members);
      }
      return;
  }
}

function collectExpression(expression: Expression, namespace: Str, members: Set<Str>): void {
  switch (expression.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
      return;
    case "IdentifierExpr":
      return;
    case "UnaryExpr":
      collectExpression(expression.operand, namespace, members);
      return;
    case "BinaryExpr":
      collectExpression(expression.left, namespace, members);
      collectExpression(expression.right, namespace, members);
      return;
    case "CallExpr":
      collectQualifiedName(expression.callee, namespace, members);
      for (const typeArg of expression.typeArgs ?? []) collectType(typeArg, namespace, members);
      for (const arg of expression.args) collectExpression(arg, namespace, members);
      return;
    case "MethodCallExpr":
      if (expression.receiver.kind === "IdentifierExpr" && expression.receiver.name === namespace) {
        members.add(expression.method);
      } else {
        collectExpression(expression.receiver, namespace, members);
      }
      for (const arg of expression.args) collectExpression(arg, namespace, members);
      return;
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
      collectNamespaceField(expression, namespace, members);
      collectExpression(expression.operand, namespace, members);
      return;
    case "RecordLiteralExpr":
      for (const field of expression.fields) {
        collectExpression(field.expression, namespace, members);
      }
      return;
    case "ArrayLiteralExpr":
      for (const element of expression.elements) collectExpression(element, namespace, members);
      return;
    case "IndexExpr":
      collectExpression(expression.operand, namespace, members);
      collectExpression(expression.index, namespace, members);
      return;
  }
}

function collectNamespaceField(
  expression: Extract<Expression, { kind: "FieldAccessExpr" | "PostfixPointerExpr" }>,
  namespace: Str,
  members: Set<Str>,
): void {
  if (expression.kind !== "FieldAccessExpr") return;
  if (expression.operand.kind !== "IdentifierExpr") return;
  if (expression.operand.name !== namespace) return;
  members.add(expression.field);
}

function collectType(type: TypeRef, namespace: Str, members: Set<Str>): void {
  switch (type.kind) {
    case "NamedTypeRef":
      collectNamedType(type.name, namespace, members);
      for (const typeArg of type.typeArgs ?? []) collectType(typeArg, namespace, members);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
    case "SliceTypeRef":
      collectType(type.element, namespace, members);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectType(param.type, namespace, members);
      collectType(type.returnType, namespace, members);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectType(field.type, namespace, members);
      return;
  }
}

function collectNamedType(name: Str, namespace: Str, members: Set<Str>): void {
  collectQualifiedName(name, namespace, members);
}

function collectQualifiedName(name: Str, namespace: Str, members: Set<Str>): void {
  const prefix = `${namespace}.`;
  if (!name.startsWith(prefix)) return;
  const member = name.slice(prefix.length).split(".")[0];
  if (member.length > 0) members.add(member);
}
