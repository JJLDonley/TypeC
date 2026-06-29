import type { Expression, FunctionDecl, Program, Statement } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { check } from "checker/mod.ts";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser/mod.ts";
import { resolve } from "core/resolver.ts";
import type { Token } from "core/token.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import type { TypedProgram } from "core/tast.ts";
import type { JsonRecord, JsonValue, LspPosition, Str } from "lsp/types.ts";

const TYPE_HINT_KIND = 1;

export function compilerInlayHints(text: Str, tokens: Token[]): JsonRecord[] {
  try {
    const program = parse(lex(text));
    const checked = check(resolve(instantiateGenerics(program)));
    return [
      ...inferredLocalTypeHints(checked, tokens),
      ...genericTypeArgumentHints(checked, inferredGenericCalls(program)),
    ];
  } catch (_) {
    return [];
  }
}

function inferredLocalTypeHints(program: TypedProgram, tokens: Token[]): JsonRecord[] {
  return program.functions.flatMap((fn) => functionLocalTypeHints(fn, program, tokens));
}

function functionLocalTypeHints(
  fn: FunctionDecl,
  program: TypedProgram,
  tokens: Token[],
): JsonRecord[] {
  if (fn.body === null) return [];
  return statementLocalTypeHints(fn.body.statements, program, tokens);
}

function statementLocalTypeHints(
  statements: Statement[],
  program: TypedProgram,
  tokens: Token[],
): JsonRecord[] {
  return statements.flatMap((statement) => statementLocalTypeHint(statement, program, tokens));
}

function statementLocalTypeHint(
  statement: Statement,
  program: TypedProgram,
  tokens: Token[],
): JsonRecord[] {
  switch (statement.kind) {
    case "VarDeclStmt":
      return [
        ...varDeclTypeHint(statement, program, tokens),
        ...expressionLocalTypeHints(statement.initializer, program, tokens),
      ];
    case "ReturnStmt":
      return statement.expression
        ? expressionLocalTypeHints(statement.expression, program, tokens)
        : [];
    case "ExpressionStmt":
    case "DeferStmt":
      return expressionLocalTypeHints(statement.expression, program, tokens);
    case "AssignmentStmt":
      return [
        ...expressionLocalTypeHints(statement.target, program, tokens),
        ...expressionLocalTypeHints(statement.expression, program, tokens),
      ];
    case "IncDecStmt":
      return expressionLocalTypeHints(statement.target, program, tokens);
    case "SwitchStmt":
      return [
        ...expressionLocalTypeHints(statement.expression, program, tokens),
        ...statement.cases.flatMap((switchCase) => [
          ...switchCase.labels.flatMap((label) => expressionLocalTypeHints(label, program, tokens)),
          ...statementLocalTypeHints(switchCase.statements, program, tokens),
        ]),
        ...(statement.defaultCase
          ? statementLocalTypeHints(statement.defaultCase.statements, program, tokens)
          : []),
      ];
    case "WhileStmt":
      return [
        ...expressionLocalTypeHints(statement.condition, program, tokens),
        ...statementLocalTypeHints(statement.body.statements, program, tokens),
      ];
    case "DoWhileStmt":
      return [
        ...statementLocalTypeHints(statement.body.statements, program, tokens),
        ...expressionLocalTypeHints(statement.condition, program, tokens),
      ];
    case "ForStmt":
      return [
        ...(statement.initializer
          ? statementLocalTypeHint(statement.initializer, program, tokens)
          : []),
        ...expressionLocalTypeHints(statement.condition, program, tokens),
        ...(statement.update ? statementLocalTypeHint(statement.update, program, tokens) : []),
        ...statementLocalTypeHints(statement.body.statements, program, tokens),
      ];
    case "ForOfStmt":
    case "ForInStmt":
      return [
        ...expressionLocalTypeHints(statement.iterable, program, tokens),
        ...statementLocalTypeHints(statement.body.statements, program, tokens),
      ];
    case "IfStmt":
      return [
        ...expressionLocalTypeHints(statement.condition, program, tokens),
        ...statementLocalTypeHints(statement.thenBody.statements, program, tokens),
        ...(statement.elseBody
          ? statementLocalTypeHints(statement.elseBody.statements, program, tokens)
          : []),
      ];
    case "RecordRestStmt":
      return expressionLocalTypeHints(statement.source, program, tokens);
    case "ArrayDestructureStmt":
      return expressionLocalTypeHints(statement.source, program, tokens);
    case "EmptyStmt":
    case "BreakStmt":
    case "ContinueStmt":
      return [];
  }
}

function varDeclTypeHint(
  statement: Extract<Statement, { kind: "VarDeclStmt" }>,
  program: TypedProgram,
  tokens: Token[],
): JsonRecord[] {
  if (statement.type !== null) return [];
  const type = program.expressionTypes.get(spanKey(statement.initializer.span))?.type ?? null;
  if (type === null || type === "<error>") return [];
  const position = varNameEndPosition(statement.name, statement.span, tokens);
  if (position === null) return [];
  return [typeHint(position, `: ${type}`)];
}

function expressionLocalTypeHints(
  expr: Expression,
  program: TypedProgram,
  tokens: Token[],
): JsonRecord[] {
  switch (expr.kind) {
    case "ArrowFunctionExpr":
      return expressionLocalTypeHints(expr.body, program, tokens);
    case "UnaryExpr":
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
      return expressionLocalTypeHints(expr.operand, program, tokens);
    case "BinaryExpr":
      return [
        ...expressionLocalTypeHints(expr.left, program, tokens),
        ...expressionLocalTypeHints(expr.right, program, tokens),
      ];
    case "ConditionalExpr":
      return [
        ...expressionLocalTypeHints(expr.condition, program, tokens),
        ...expressionLocalTypeHints(expr.whenTrue, program, tokens),
        ...expressionLocalTypeHints(expr.whenFalse, program, tokens),
      ];
    case "NullishCoalesceExpr":
      return [
        ...expressionLocalTypeHints(expr.left, program, tokens),
        ...expressionLocalTypeHints(expr.fallback, program, tokens),
      ];
    case "CastExpr":
    case "SatisfiesExpr":
      return expressionLocalTypeHints(expr.expression, program, tokens);
    case "CallExpr":
    case "NewExpr":
      return expr.args.flatMap((arg) => expressionLocalTypeHints(arg, program, tokens));
    case "MethodCallExpr":
    case "OptionalMethodCallExpr":
      return [
        ...expressionLocalTypeHints(expr.receiver, program, tokens),
        ...expr.args.flatMap((arg) => expressionLocalTypeHints(arg, program, tokens)),
      ];
    case "FieldAccessExpr":
    case "OptionalFieldAccessExpr":
      return expressionLocalTypeHints(expr.operand, program, tokens);
    case "OptionalIndexExpr":
    case "IndexExpr":
      return [
        ...expressionLocalTypeHints(expr.operand, program, tokens),
        ...expressionLocalTypeHints(expr.index, program, tokens),
      ];
    case "RecordLiteralExpr":
      return expr.fields.flatMap((field) =>
        expressionLocalTypeHints(field.expression, program, tokens)
      );
    case "ArrayLiteralExpr":
      return expr.elements.flatMap((element) => expressionLocalTypeHints(element, program, tokens));
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
    case "IdentifierExpr":
      return [];
  }
}

function genericTypeArgumentHints(
  program: TypedProgram,
  inferredCalls: Map<Str, Str>,
): JsonRecord[] {
  return program.functions.flatMap((fn) => functionGenericTypeArgumentHints(fn, inferredCalls));
}

function functionGenericTypeArgumentHints(
  fn: FunctionDecl,
  inferredCalls: Map<Str, Str>,
): JsonRecord[] {
  if (fn.body === null) return [];
  return statementGenericTypeArgumentHints(fn.body.statements, inferredCalls);
}

function statementGenericTypeArgumentHints(
  statements: Statement[],
  inferredCalls: Map<Str, Str>,
): JsonRecord[] {
  return statements.flatMap((statement) =>
    statementGenericTypeArgumentHint(statement, inferredCalls)
  );
}

function statementGenericTypeArgumentHint(
  statement: Statement,
  inferredCalls: Map<Str, Str>,
): JsonRecord[] {
  return statementExpressions(statement).flatMap((expr) =>
    expressionGenericTypeArgumentHints(expr, inferredCalls)
  );
}

function expressionGenericTypeArgumentHints(
  expr: Expression,
  inferredCalls: Map<Str, Str>,
): JsonRecord[] {
  const children = childExpressions(expr).flatMap((child) =>
    expressionGenericTypeArgumentHints(child, inferredCalls)
  );
  if (expr.kind !== "CallExpr") return children;
  const sourceName = inferredCalls.get(spanKey(expr.span)) ?? null;
  if (sourceName === null) return children;
  const label = inferredGenericLabel(expr.callee, sourceName);
  if (label === null) return children;
  return [typeHint(callNameEndPosition(expr, sourceName), label), ...children];
}

function inferredGenericCalls(program: Program): Map<Str, Str> {
  const genericNames = new Set(
    program.functions.filter((fn) => (fn.genericParams ?? []).length > 0).map((fn) => fn.name),
  );
  const calls = new Map<Str, Str>();
  for (const fn of program.functions) {
    if (fn.body !== null) collectInferredGenericCalls(fn.body.statements, genericNames, calls);
  }
  return calls;
}

function collectInferredGenericCalls(
  statements: Statement[],
  genericNames: Set<Str>,
  calls: Map<Str, Str>,
): void {
  for (const statement of statements) {
    for (const expr of statementExpressions(statement)) {
      collectInferredGenericCall(expr, genericNames, calls);
    }
  }
}

function collectInferredGenericCall(
  expr: Expression,
  genericNames: Set<Str>,
  calls: Map<Str, Str>,
): void {
  if (
    expr.kind === "CallExpr" && genericNames.has(expr.callee) && (expr.typeArgs?.length ?? 0) === 0
  ) {
    calls.set(spanKey(expr.span), expr.callee);
  }
  for (const child of childExpressions(expr)) {
    collectInferredGenericCall(child, genericNames, calls);
  }
}

function inferredGenericLabel(callee: Str, sourceName: Str): Str | null {
  const prefix = `${sourceName}_`;
  if (!callee.startsWith(prefix)) return null;
  return `<${callee.slice(prefix.length)}>`;
}

function statementExpressions(statement: Statement): Expression[] {
  switch (statement.kind) {
    case "VarDeclStmt":
      return [statement.initializer];
    case "ReturnStmt":
      return statement.expression ? [statement.expression] : [];
    case "ExpressionStmt":
    case "DeferStmt":
      return [statement.expression];
    case "AssignmentStmt":
      return [statement.target, statement.expression];
    case "IncDecStmt":
      return [statement.target];
    case "SwitchStmt":
      return [
        statement.expression,
        ...statement.cases.flatMap((switchCase) => [
          ...switchCase.labels,
          ...switchCase.statements.flatMap(statementExpressions),
        ]),
        ...(statement.defaultCase
          ? statement.defaultCase.statements.flatMap(statementExpressions)
          : []),
      ];
    case "WhileStmt":
      return [statement.condition, ...statement.body.statements.flatMap(statementExpressions)];
    case "DoWhileStmt":
      return [...statement.body.statements.flatMap(statementExpressions), statement.condition];
    case "ForStmt":
      return [
        ...(statement.initializer ? statementExpressions(statement.initializer) : []),
        statement.condition,
        ...(statement.update ? statementExpressions(statement.update) : []),
        ...statement.body.statements.flatMap(statementExpressions),
      ];
    case "ForOfStmt":
    case "ForInStmt":
      return [statement.iterable, ...statement.body.statements.flatMap(statementExpressions)];
    case "IfStmt":
      return [
        statement.condition,
        ...statement.thenBody.statements.flatMap(statementExpressions),
        ...(statement.elseBody ? statement.elseBody.statements.flatMap(statementExpressions) : []),
      ];
    case "RecordRestStmt":
    case "ArrayDestructureStmt":
      return [statement.source];
    case "EmptyStmt":
    case "BreakStmt":
    case "ContinueStmt":
      return [];
  }
}

function childExpressions(expr: Expression): Expression[] {
  switch (expr.kind) {
    case "ArrowFunctionExpr":
      return [expr.body];
    case "UnaryExpr":
    case "PostfixPointerExpr":
    case "NonNullAssertExpr":
      return [expr.operand];
    case "BinaryExpr":
      return [expr.left, expr.right];
    case "ConditionalExpr":
      return [expr.condition, expr.whenTrue, expr.whenFalse];
    case "NullishCoalesceExpr":
      return [expr.left, expr.fallback];
    case "CastExpr":
    case "SatisfiesExpr":
      return [expr.expression];
    case "CallExpr":
    case "NewExpr":
      return expr.args;
    case "MethodCallExpr":
    case "OptionalMethodCallExpr":
      return [expr.receiver, ...expr.args];
    case "FieldAccessExpr":
    case "OptionalFieldAccessExpr":
      return [expr.operand];
    case "OptionalIndexExpr":
    case "IndexExpr":
      return [expr.operand, expr.index];
    case "RecordLiteralExpr":
      return expr.fields.map((field) => field.expression);
    case "ArrayLiteralExpr":
      return expr.elements;
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "ZeroValueExpr":
    case "IdentifierExpr":
      return [];
  }
}

function varNameEndPosition(name: Str, span: SourceSpan, tokens: Token[]): LspPosition | null {
  const token = tokens.find((candidate) =>
    candidate.text === name && candidate.span.start.offset >= span.start.offset &&
    candidate.span.end.offset <= span.end.offset
  );
  return token === undefined ? null : tokenEndPosition(token);
}

function callNameEndPosition(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  sourceName: Str,
): LspPosition {
  return {
    line: expr.span.start.line - 1,
    character: expr.span.start.column - 1 + sourceName.length,
  };
}

function typeHint(position: LspPosition, label: Str): JsonRecord {
  return { position: position as unknown as JsonValue, label, kind: TYPE_HINT_KIND };
}

function tokenEndPosition(token: Token): LspPosition {
  return {
    line: token.span.end.line - 1,
    character: token.span.end.column - 1,
  };
}
