import type {
  BlockStmt,
  ConstDecl,
  EnumDecl,
  Expression,
  FunctionDecl,
  InterfaceDecl,
  Statement,
  TypeAliasDecl,
  TypeRef,
} from "core/ast.ts";
import type { DependencySet } from "module/dependency_index.ts";

export type Str = string;

export function collectTypeAliasDeps(
  typeAlias: TypeAliasDecl | undefined,
  selected: DependencySet,
): void {
  if (!typeAlias) return;
  collectTypeDeps(typeAlias.type, selected);
}

export function collectInterfaceDeps(
  interfaceDecl: InterfaceDecl | undefined,
  selected: DependencySet,
): void {
  if (!interfaceDecl) return;
  for (const method of interfaceDecl.methods) {
    for (const param of method.params) collectTypeDeps(param.type, selected);
    collectTypeDeps(method.returnType, selected);
  }
}

export function collectEnumDeps(enumDecl: EnumDecl | undefined, selected: DependencySet): void {
  if (!enumDecl) return;
  for (const member of enumDecl.members) {
    if (member.initializer) collectExpressionDeps(member.initializer, selected);
  }
}

export function collectConstDeps(constant: ConstDecl | undefined, selected: DependencySet): void {
  if (!constant) return;
  collectTypeDeps(constant.type, selected);
  collectExpressionDeps(constant.initializer, selected);
}

export function collectFunctionDeps(fn: FunctionDecl | undefined, selected: DependencySet): void {
  if (!fn) return;
  const ignoredTypes = new Set<Str>((fn.genericParams ?? []).map((param) => param.name));
  collectGenericParamDeps(fn, selected, ignoredTypes);
  for (const param of fn.params) collectTypeDeps(param.type, selected, ignoredTypes);
  collectTypeDeps(fn.returnType, selected, ignoredTypes);
  if (fn.body) collectBlockDeps(fn.body, selected, ignoredTypes);
}

function collectGenericParamDeps(
  fn: FunctionDecl,
  selected: DependencySet,
  ignoredTypes: Set<Str>,
): void {
  for (const param of fn.genericParams ?? []) {
    if (param.constraint) collectTypeDeps(param.constraint, selected, ignoredTypes);
  }
}

function collectBlockDeps(
  block: BlockStmt,
  selected: DependencySet,
  ignoredTypes: Set<Str> = new Set(),
): void {
  for (const statement of block.statements) collectStatementDeps(statement, selected, ignoredTypes);
}

function collectStatementDeps(
  statement: Statement,
  selected: DependencySet,
  ignoredTypes: Set<Str>,
): void {
  switch (statement.kind) {
    case "ReturnStmt":
      if (statement.expression) collectExpressionDeps(statement.expression, selected, ignoredTypes);
      return;
    case "ExpressionStmt":
      collectExpressionDeps(statement.expression, selected, ignoredTypes);
      return;
    case "BreakStmt":
      return;
    case "VarDeclStmt":
      collectTypeDeps(statement.type, selected, ignoredTypes);
      collectExpressionDeps(statement.initializer, selected, ignoredTypes);
      return;
    case "AssignmentStmt":
      collectExpressionDeps(statement.expression, selected, ignoredTypes);
      return;
    case "SwitchStmt":
      collectSwitchDeps(statement, selected, ignoredTypes);
      return;
    case "WhileStmt":
      collectExpressionDeps(statement.condition, selected, ignoredTypes);
      collectBlockDeps(statement.body, selected, ignoredTypes);
      return;
    case "IfStmt":
      collectExpressionDeps(statement.condition, selected, ignoredTypes);
      collectBlockDeps(statement.thenBody, selected, ignoredTypes);
      if (statement.elseBody) collectBlockDeps(statement.elseBody, selected, ignoredTypes);
      return;
  }
}

function collectSwitchDeps(
  statement: Extract<Statement, { kind: "SwitchStmt" }>,
  selected: DependencySet,
  ignoredTypes: Set<Str>,
): void {
  collectExpressionDeps(statement.expression, selected, ignoredTypes);
  for (const switchCase of statement.cases) {
    for (const label of switchCase.labels) collectExpressionDeps(label, selected, ignoredTypes);
    for (const child of switchCase.statements) collectStatementDeps(child, selected, ignoredTypes);
  }
  if (!statement.defaultCase) return;
  for (const child of statement.defaultCase.statements) {
    collectStatementDeps(child, selected, ignoredTypes);
  }
}

function collectExpressionDeps(
  expression: Expression,
  selected: DependencySet,
  ignoredTypes: Set<Str> = new Set(),
): void {
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
      collectExpressionDeps(expression.operand, selected, ignoredTypes);
      return;
    case "BinaryExpr":
      collectExpressionDeps(expression.left, selected, ignoredTypes);
      collectExpressionDeps(expression.right, selected, ignoredTypes);
      return;
    case "CallExpr":
      collectCallDeps(expression, selected, ignoredTypes);
      return;
    case "MethodCallExpr":
      collectExpressionDeps(expression.receiver, selected, ignoredTypes);
      for (const arg of expression.args) collectExpressionDeps(arg, selected, ignoredTypes);
      return;
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
      collectExpressionDeps(expression.operand, selected, ignoredTypes);
      return;
    case "RecordLiteralExpr":
      for (const field of expression.fields) {
        collectExpressionDeps(field.expression, selected, ignoredTypes);
      }
      return;
    case "ArrayLiteralExpr":
      for (const element of expression.elements) {
        collectExpressionDeps(element, selected, ignoredTypes);
      }
      return;
    case "IndexExpr":
      collectExpressionDeps(expression.operand, selected, ignoredTypes);
      collectExpressionDeps(expression.index, selected, ignoredTypes);
      return;
  }
}

function collectCallDeps(
  expression: Extract<Expression, { kind: "CallExpr" }>,
  selected: DependencySet,
  ignoredTypes: Set<Str>,
): void {
  selected.functions.add(expression.callee);
  for (const typeArg of expression.typeArgs ?? []) collectTypeDeps(typeArg, selected, ignoredTypes);
  for (const arg of expression.args) collectExpressionDeps(arg, selected, ignoredTypes);
}

function collectTypeDeps(
  type: TypeRef,
  selected: DependencySet,
  ignoredTypes: Set<Str> = new Set(),
): void {
  switch (type.kind) {
    case "NamedTypeRef":
      if (!ignoredTypes.has(type.name)) selected.types.add(type.name);
      for (const typeArg of type.typeArgs ?? []) collectTypeDeps(typeArg, selected, ignoredTypes);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
    case "SliceTypeRef":
      collectTypeDeps(type.element, selected, ignoredTypes);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeDeps(param.type, selected, ignoredTypes);
      collectTypeDeps(type.returnType, selected, ignoredTypes);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeDeps(field.type, selected, ignoredTypes);
      return;
  }
}
