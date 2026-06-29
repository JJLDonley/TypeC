import type { BlockStmt, Expression, FunctionDecl, Program, Statement, TypeRef } from "core/ast.ts";

export type Str = string;

export function collectNamespaceMembers(program: Program, namespace: Str): Set<Str> {
  const members = new Set<Str>();
  for (const typeAlias of program.typeAliases) collectType(typeAlias.type, namespace, members);
  for (const constant of program.constants ?? []) collectConstantUse(constant, namespace, members);
  for (const fn of program.functions) collectFunction(fn, namespace, members);
  return members;
}

function collectConstantUse(
  constant: NonNullable<Program["constants"]>[number],
  namespace: Str,
  members: Set<Str>,
): void {
  collectType(constant.type, namespace, members);
  collectExpression(constant.initializer, namespace, members);
}

function collectFunction(fn: FunctionDecl, namespace: Str, members: Set<Str>): void {
  for (const param of fn.params) collectType(param.type, namespace, members);
  collectType(fn.returnType, namespace, members);
  if (fn.body !== null) collectBlock(fn.body, namespace, members);
}

function collectBlock(block: BlockStmt, namespace: Str, members: Set<Str>): void {
  for (const statement of block.statements) collectStatement(statement, namespace, members);
}

function collectStatement(statement: Statement, namespace: Str, members: Set<Str>): void {
  switch (statement.kind) {
    case "EmptyStmt":
    case "BreakStmt":
    case "ContinueStmt":
      return;
    case "ReturnStmt":
      if (statement.expression !== null) {
        collectExpression(statement.expression, namespace, members);
      }
      return;
    case "DeferStmt":
    case "ExpressionStmt":
      collectExpression(statement.expression, namespace, members);
      return;
    case "VarDeclStmt":
      if (statement.type !== null) collectType(statement.type, namespace, members);
      collectExpression(statement.initializer, namespace, members);
      return;
    case "RecordRestStmt":
    case "ArrayDestructureStmt":
      collectExpression(statement.source, namespace, members);
      return;
    case "AssignmentStmt":
      collectExpression(statement.target, namespace, members);
      collectExpression(statement.expression, namespace, members);
      return;
    case "IncDecStmt":
      collectExpression(statement.target, namespace, members);
      return;
    case "SwitchStmt":
      collectSwitchStatement(statement, namespace, members);
      return;
    case "WhileStmt":
      collectExpression(statement.condition, namespace, members);
      collectBlock(statement.body, namespace, members);
      return;
    case "DoWhileStmt":
      collectBlock(statement.body, namespace, members);
      collectExpression(statement.condition, namespace, members);
      return;
    case "ForStmt":
      collectForStatement(statement, namespace, members);
      return;
    case "ForOfStmt":
    case "ForInStmt":
      collectExpression(statement.iterable, namespace, members);
      collectBlock(statement.body, namespace, members);
      return;
    case "IfStmt":
      collectExpression(statement.condition, namespace, members);
      collectBlock(statement.thenBody, namespace, members);
      if (statement.elseBody !== null) collectBlock(statement.elseBody, namespace, members);
      return;
  }
}

function collectSwitchStatement(
  statement: Extract<Statement, { kind: "SwitchStmt" }>,
  namespace: Str,
  members: Set<Str>,
): void {
  collectExpression(statement.expression, namespace, members);
  for (const switchCase of statement.cases) {
    for (const label of switchCase.labels) collectExpression(label, namespace, members);
    for (const child of switchCase.statements) collectStatement(child, namespace, members);
  }
  for (const child of statement.defaultCase?.statements ?? []) {
    collectStatement(child, namespace, members);
  }
}

function collectForStatement(
  statement: Extract<Statement, { kind: "ForStmt" }>,
  namespace: Str,
  members: Set<Str>,
): void {
  if (statement.initializer !== null) collectStatement(statement.initializer, namespace, members);
  collectExpression(statement.condition, namespace, members);
  if (statement.update !== null) collectStatement(statement.update, namespace, members);
  collectBlock(statement.body, namespace, members);
}

function collectExpression(expression: Expression, namespace: Str, members: Set<Str>): void {
  switch (expression.kind) {
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "ZeroValueExpr":
    case "StringLiteral":
    case "IdentifierExpr":
      return;
    case "ArrowFunctionExpr":
      collectExpression(expression.body, namespace, members);
      return;
    case "UnaryExpr":
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
      collectExpression(expression.operand, namespace, members);
      return;
    case "BinaryExpr":
      collectExpression(expression.left, namespace, members);
      collectExpression(expression.right, namespace, members);
      return;
    case "ConditionalExpr":
      collectExpression(expression.condition, namespace, members);
      collectExpression(expression.whenTrue, namespace, members);
      collectExpression(expression.whenFalse, namespace, members);
      return;
    case "NullishCoalesceExpr":
      collectExpression(expression.left, namespace, members);
      collectExpression(expression.fallback, namespace, members);
      return;
    case "CastExpr":
    case "SatisfiesExpr":
      collectType(expression.type, namespace, members);
      collectExpression(expression.expression, namespace, members);
      return;
    case "CallExpr":
      collectQualifiedName(expression.callee, namespace, members);
      for (const typeArg of expression.typeArgs ?? []) collectType(typeArg, namespace, members);
      for (const arg of expression.args) collectExpression(arg, namespace, members);
      return;
    case "NewExpr":
      collectQualifiedName(expression.className, namespace, members);
      for (const typeArg of expression.typeArgs ?? []) collectType(typeArg, namespace, members);
      for (const arg of expression.args) collectExpression(arg, namespace, members);
      return;
    case "MethodCallExpr":
      collectMethodCallExpression(expression, namespace, members);
      return;
    case "FieldAccessExpr":
      if (!collectNamespaceField(expression, namespace, members)) {
        collectExpression(expression.operand, namespace, members);
      }
      return;
    case "OptionalFieldAccessExpr":
      collectExpression(expression.operand, namespace, members);
      return;
    case "OptionalMethodCallExpr":
      collectExpression(expression.receiver, namespace, members);
      for (const arg of expression.args) collectExpression(arg, namespace, members);
      return;
    case "OptionalIndexExpr":
    case "IndexExpr":
      collectExpression(expression.operand, namespace, members);
      collectExpression(expression.index, namespace, members);
      return;
    case "RecordLiteralExpr":
      for (const field of expression.fields) {
        collectExpression(field.expression, namespace, members);
      }
      return;
    case "ArrayLiteralExpr":
      for (const element of expression.elements) collectExpression(element, namespace, members);
      return;
  }
}

function collectMethodCallExpression(
  expression: Extract<Expression, { kind: "MethodCallExpr" }>,
  namespace: Str,
  members: Set<Str>,
): void {
  if (expression.receiver.kind === "IdentifierExpr" && expression.receiver.name === namespace) {
    members.add(expression.method);
  } else {
    collectExpression(expression.receiver, namespace, members);
  }
  for (const arg of expression.args) collectExpression(arg, namespace, members);
}

function collectNamespaceField(
  expression: Extract<Expression, { kind: "FieldAccessExpr" }>,
  namespace: Str,
  members: Set<Str>,
): boolean {
  if (expression.operand.kind !== "IdentifierExpr") return false;
  if (expression.operand.name !== namespace) return false;
  members.add(expression.field);
  return true;
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
    case "TupleTypeRef":
      for (const element of type.elements) collectType(element, namespace, members);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectType(member, namespace, members);
      return;
    case "ConditionalTypeRef":
      collectType(type.checkType, namespace, members);
      collectType(type.extendsType, namespace, members);
      collectType(type.trueType, namespace, members);
      collectType(type.falseType, namespace, members);
      return;
    case "IndexedAccessTypeRef":
      collectType(type.objectType, namespace, members);
      return;
    case "MappedTypeRef":
      collectType(type.sourceType, namespace, members);
      collectType(type.valueType, namespace, members);
      return;
    case "KeyofTypeRef":
      collectType(type.target, namespace, members);
      return;
    case "TypeofTypeRef":
      collectQualifiedName(type.name, namespace, members);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectType(field.type, namespace, members);
      return;
    case "LiteralTypeRef":
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
