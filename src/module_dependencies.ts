import type { BlockStmt, Expression, FunctionDecl, Program, Statement, TypeAliasDecl, TypeRef } from "./ast.ts";

type Str = string;
type b8 = boolean;
type usize = number;

interface DependencySet {
  types: Set<Str>;
  functions: Set<Str>;
}

interface ProgramIndex {
  types: Map<Str, TypeAliasDecl>;
  functions: Map<Str, FunctionDecl>;
}

export function selectDependencyClosure(program: Program, rootTypes: Str[], rootFunctions: Str[]): Program {
  const index = indexProgram(program);
  const selected = createDependencySet(rootTypes, rootFunctions);
  collectClosure(selected, index);
  return filterProgram(program, selected);
}

function indexProgram(program: Program): ProgramIndex {
  return {
    types: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
  };
}

function createDependencySet(types: Str[], functions: Str[]): DependencySet {
  return { types: new Set(types), functions: new Set(functions) };
}

function collectClosure(selected: DependencySet, index: ProgramIndex): void {
  let changed = true;
  while (changed) changed = collectPass(selected, index);
}

function collectPass(selected: DependencySet, index: ProgramIndex): b8 {
  const before = dependencyCount(selected);
  for (const name of [...selected.types]) collectTypeAliasDeps(index.types.get(name), selected);
  for (const name of [...selected.functions]) collectFunctionDeps(index.functions.get(name), selected);
  return dependencyCount(selected) !== before;
}

function dependencyCount(selected: DependencySet): usize {
  return selected.types.size + selected.functions.size;
}

function collectTypeAliasDeps(typeAlias: TypeAliasDecl | undefined, selected: DependencySet): void {
  if (!typeAlias) return;
  collectTypeDeps(typeAlias.type, selected);
}

function collectFunctionDeps(fn: FunctionDecl | undefined, selected: DependencySet): void {
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
    case "IdentifierExpr":
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
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeDeps(field.type, selected);
      return;
  }
}

function filterProgram(program: Program, selected: DependencySet): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: program.typeAliases.filter((typeAlias) => selected.types.has(typeAlias.name)),
    functions: program.functions.filter((fn) => selected.functions.has(fn.name)),
    span: program.span,
  };
}
