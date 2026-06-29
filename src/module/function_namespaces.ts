import type {
  BlockStmt,
  ConstDecl,
  Expression,
  FunctionDecl,
  Program,
  Statement,
} from "core/ast.ts";

type Str = string;

interface ValueNamespaceScope {
  functions: Set<Str>;
  values: Set<Str>;
}

export function namespaceProgramFunctions(program: Program, namespace: Str): Program {
  const scope = valueNamespaceScope(program);
  return {
    ...program,
    constants: (program.constants ?? []).map((constant) =>
      namespaceConstantInitializer(constant, namespace, scope)
    ),
    functions: program.functions.map((fn) => namespaceFunctionBody(fn, namespace, scope)),
  };
}

function valueNamespaceScope(program: Program): ValueNamespaceScope {
  const functions = new Set<Str>(program.functions.map((fn) => fn.name));
  return {
    functions,
    values: new Set<Str>([
      ...functions,
      ...(program.constants ?? []).map((constant) => constant.name),
    ]),
  };
}

function namespaceConstantInitializer(
  constant: ConstDecl,
  namespace: Str,
  scope: ValueNamespaceScope,
): ConstDecl {
  return {
    ...constant,
    initializer: namespaceExpression(constant.initializer, namespace, scope),
  };
}

function namespaceFunctionBody(
  fn: FunctionDecl,
  namespace: Str,
  scope: ValueNamespaceScope,
): FunctionDecl {
  return fn.body ? { ...fn, body: namespaceBlock(fn.body, namespace, scope) } : fn;
}

function namespaceBlock(block: BlockStmt, namespace: Str, scope: ValueNamespaceScope): BlockStmt {
  return {
    ...block,
    statements: block.statements.map((stmt) => namespaceStatement(stmt, namespace, scope)),
  };
}

function namespaceStatement(
  stmt: Statement,
  namespace: Str,
  scope: ValueNamespaceScope,
): Statement {
  switch (stmt.kind) {
    case "EmptyStmt":
    case "BreakStmt":
    case "ContinueStmt":
      return stmt;
    case "ReturnStmt":
      return stmt.expression
        ? { ...stmt, expression: namespaceExpression(stmt.expression, namespace, scope) }
        : stmt;
    case "DeferStmt":
    case "ExpressionStmt":
      return { ...stmt, expression: namespaceExpression(stmt.expression, namespace, scope) };
    case "VarDeclStmt":
      return { ...stmt, initializer: namespaceExpression(stmt.initializer, namespace, scope) };
    case "RecordRestStmt":
    case "ArrayDestructureStmt":
      return { ...stmt, source: namespaceExpression(stmt.source, namespace, scope) };
    case "AssignmentStmt":
      return {
        ...stmt,
        target: namespaceExpression(stmt.target, namespace, scope) as typeof stmt.target,
        expression: namespaceExpression(stmt.expression, namespace, scope),
      };
    case "IncDecStmt":
      return {
        ...stmt,
        target: namespaceExpression(stmt.target, namespace, scope) as typeof stmt.target,
      };
    case "SwitchStmt":
      return namespaceSwitchStatement(stmt, namespace, scope);
    case "WhileStmt":
      return {
        ...stmt,
        condition: namespaceExpression(stmt.condition, namespace, scope),
        body: namespaceBlock(stmt.body, namespace, scope),
      };
    case "DoWhileStmt":
      return {
        ...stmt,
        body: namespaceBlock(stmt.body, namespace, scope),
        condition: namespaceExpression(stmt.condition, namespace, scope),
      };
    case "ForStmt":
      return namespaceForStatement(stmt, namespace, scope);
    case "ForOfStmt":
    case "ForInStmt":
      return {
        ...stmt,
        iterable: namespaceExpression(stmt.iterable, namespace, scope),
        body: namespaceBlock(stmt.body, namespace, scope),
      };
    case "IfStmt":
      return {
        ...stmt,
        condition: namespaceExpression(stmt.condition, namespace, scope),
        thenBody: namespaceBlock(stmt.thenBody, namespace, scope),
        elseBody: stmt.elseBody ? namespaceBlock(stmt.elseBody, namespace, scope) : null,
      };
  }
}

function namespaceSwitchStatement(
  stmt: Extract<Statement, { kind: "SwitchStmt" }>,
  namespace: Str,
  scope: ValueNamespaceScope,
): Statement {
  return {
    ...stmt,
    expression: namespaceExpression(stmt.expression, namespace, scope),
    cases: stmt.cases.map((switchCase) => ({
      ...switchCase,
      labels: switchCase.labels.map((label) => namespaceExpression(label, namespace, scope)),
      statements: switchCase.statements.map((child) => namespaceStatement(child, namespace, scope)),
    })),
    defaultCase: stmt.defaultCase
      ? {
        ...stmt.defaultCase,
        statements: stmt.defaultCase.statements.map((child) =>
          namespaceStatement(child, namespace, scope)
        ),
      }
      : null,
  };
}

function namespaceForStatement(
  stmt: Extract<Statement, { kind: "ForStmt" }>,
  namespace: Str,
  scope: ValueNamespaceScope,
): Statement {
  return {
    ...stmt,
    initializer: stmt.initializer
      ? namespaceStatement(stmt.initializer, namespace, scope) as typeof stmt.initializer
      : null,
    condition: namespaceExpression(stmt.condition, namespace, scope),
    update: stmt.update
      ? namespaceStatement(stmt.update, namespace, scope) as typeof stmt.update
      : null,
    body: namespaceBlock(stmt.body, namespace, scope),
  };
}

function namespaceExpression(
  expr: Expression,
  namespace: Str,
  scope: ValueNamespaceScope,
): Expression {
  switch (expr.kind) {
    case "CallExpr":
      return {
        ...expr,
        callee: namespaceCallee(expr.callee, namespace, scope.functions),
        args: expr.args.map((arg) => namespaceExpression(arg, namespace, scope)),
      };
    case "NewExpr":
      return {
        ...expr,
        args: expr.args.map((arg) => namespaceExpression(arg, namespace, scope)),
      };
    case "MethodCallExpr":
      return {
        ...expr,
        receiver: namespaceExpression(expr.receiver, namespace, scope),
        args: expr.args.map((arg) => namespaceExpression(arg, namespace, scope)),
      };
    case "UnaryExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, scope) };
    case "BinaryExpr":
      return {
        ...expr,
        left: namespaceExpression(expr.left, namespace, scope),
        right: namespaceExpression(expr.right, namespace, scope),
      };
    case "ConditionalExpr":
      return {
        ...expr,
        condition: namespaceExpression(expr.condition, namespace, scope),
        whenTrue: namespaceExpression(expr.whenTrue, namespace, scope),
        whenFalse: namespaceExpression(expr.whenFalse, namespace, scope),
      };
    case "NullishCoalesceExpr":
      return {
        ...expr,
        left: namespaceExpression(expr.left, namespace, scope),
        fallback: namespaceExpression(expr.fallback, namespace, scope),
      };
    case "CastExpr":
    case "SatisfiesExpr":
      return { ...expr, expression: namespaceExpression(expr.expression, namespace, scope) };
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, scope) };
    case "FieldAccessExpr":
    case "OptionalFieldAccessExpr":
      return { ...expr, operand: namespaceExpression(expr.operand, namespace, scope) };
    case "OptionalMethodCallExpr":
      return {
        ...expr,
        receiver: namespaceExpression(expr.receiver, namespace, scope),
        args: expr.args.map((arg) => namespaceExpression(arg, namespace, scope)),
      };
    case "OptionalIndexExpr":
      return {
        ...expr,
        operand: namespaceExpression(expr.operand, namespace, scope),
        index: namespaceExpression(expr.index, namespace, scope),
      };
    case "RecordLiteralExpr":
      return {
        ...expr,
        fields: expr.fields.map((field) => ({
          ...field,
          expression: namespaceExpression(field.expression, namespace, scope),
        })),
      };
    case "ArrayLiteralExpr":
      return {
        ...expr,
        elements: expr.elements.map((element) => namespaceExpression(element, namespace, scope)),
      };
    case "IndexExpr":
      return {
        ...expr,
        operand: namespaceExpression(expr.operand, namespace, scope),
        index: namespaceExpression(expr.index, namespace, scope),
      };
    case "IdentifierExpr":
      return namespaceIdentifier(expr, namespace, scope.values);
    case "ArrowFunctionExpr":
      return { ...expr, body: namespaceExpression(expr.body, namespace, scope) };
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
      return expr;
  }
}

function namespaceIdentifier(
  expr: Extract<Expression, { kind: "IdentifierExpr" }>,
  namespace: Str,
  values: Set<Str>,
): Expression {
  return values.has(expr.name) ? { ...expr, name: `${namespace}.${expr.name}` } : expr;
}

function namespaceCallee(callee: Str, namespace: Str, functions: Set<Str>): Str {
  return functions.has(callee) ? `${namespace}.${callee}` : callee;
}
