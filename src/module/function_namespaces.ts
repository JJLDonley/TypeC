import type { BlockStmt, Expression, FunctionDecl, Program, Statement } from "core/ast.ts";

type Str = string;

export function namespaceProgramFunctions(program: Program, namespace: Str): Program {
  const functions = new Set<Str>(program.functions.map((fn) => fn.name));
  return {
    ...program,
    functions: program.functions.map((fn) => namespaceFunctionBody(fn, namespace, functions)),
  };
}

function namespaceFunctionBody(
  fn: FunctionDecl,
  namespace: Str,
  functions: Set<Str>,
): FunctionDecl {
  return fn.body ? { ...fn, body: namespaceBlock(fn.body, namespace, functions) } : fn;
}

function namespaceBlock(block: BlockStmt, namespace: Str, functions: Set<Str>): BlockStmt {
  return {
    ...block,
    statements: block.statements.map((stmt) => namespaceStatement(stmt, namespace, functions)),
  };
}

function namespaceStatement(stmt: Statement, namespace: Str, functions: Set<Str>): Statement {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression
        ? { ...stmt, expression: namespaceExpression(stmt.expression, namespace, functions) }
        : stmt;
    case "ExpressionStmt":
      return { ...stmt, expression: namespaceExpression(stmt.expression, namespace, functions) };
    case "BreakStmt":
      return stmt;
    case "VarDeclStmt":
      return { ...stmt, initializer: namespaceExpression(stmt.initializer, namespace, functions) };
    case "AssignmentStmt":
      return { ...stmt, expression: namespaceExpression(stmt.expression, namespace, functions) };
    case "SwitchStmt":
      return {
        ...stmt,
        expression: namespaceExpression(stmt.expression, namespace, functions),
        cases: stmt.cases.map((switchCase) => ({
          ...switchCase,
          labels: switchCase.labels.map((label) =>
            namespaceExpression(label, namespace, functions)
          ),
          statements: switchCase.statements.map((child) =>
            namespaceStatement(child, namespace, functions)
          ),
        })),
        defaultCase: stmt.defaultCase
          ? {
            ...stmt.defaultCase,
            statements: stmt.defaultCase.statements.map((child) =>
              namespaceStatement(child, namespace, functions)
            ),
          }
          : null,
      };
    case "WhileStmt":
      return {
        ...stmt,
        condition: namespaceExpression(stmt.condition, namespace, functions),
        body: namespaceBlock(stmt.body, namespace, functions),
      };
    case "IfStmt":
      return {
        ...stmt,
        condition: namespaceExpression(stmt.condition, namespace, functions),
        thenBody: namespaceBlock(stmt.thenBody, namespace, functions),
        elseBody: stmt.elseBody ? namespaceBlock(stmt.elseBody, namespace, functions) : null,
      };
  }
}

function namespaceExpression(expr: Expression, namespace: Str, functions: Set<Str>): Expression {
  switch (expr.kind) {
    case "CallExpr":
      return {
        ...expr,
        callee: namespaceCallee(expr.callee, namespace, functions),
        args: expr.args.map((arg) => namespaceExpression(arg, namespace, functions)),
      };
    case "UnaryExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, functions) };
    case "BinaryExpr":
      return {
        ...expr,
        left: namespaceExpression(expr.left, namespace, functions),
        right: namespaceExpression(expr.right, namespace, functions),
      };
    case "PostfixPointerExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, functions) };
    case "FieldAccessExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, functions) };
    case "RecordLiteralExpr":
      return {
        ...expr,
        fields: expr.fields.map((field) => ({
          ...field,
          expression: namespaceExpression(field.expression, namespace, functions),
        })),
      };
    case "ArrayLiteralExpr":
      return {
        ...expr,
        elements: expr.elements.map((element) =>
          namespaceExpression(element, namespace, functions)
        ),
      };
    case "IndexExpr":
      return {
        ...expr,
        operand: namespaceExpression(expr.operand, namespace, functions),
        index: namespaceExpression(expr.index, namespace, functions),
      };
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "IdentifierExpr":
      return expr;
  }
}

function namespaceCallee(callee: Str, namespace: Str, functions: Set<Str>): Str {
  return functions.has(callee) ? `${namespace}.${callee}` : callee;
}
