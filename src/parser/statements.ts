import type { CastBlockStmt, CastExpression, CastStatement, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

export interface StatementParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  advance(): Token;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  peek(offset?: i32): Token;
  parseExpression(): CastExpression;
  parseTypeRef(): CastTypeRef;
  parseBlock(): CastBlockStmt;
}

export function parseStatementWith(parser: StatementParser): CastStatement {
  if (parser.checkText("return")) return parseReturn(parser);
  if (parser.checkText("if")) return parseIf(parser);
  if (parser.checkText("while")) return parseWhile(parser);
  if (isVariableDeclarationStart(parser)) return parseVarDecl(parser);
  if (isAssignmentStart(parser)) return parseAssignment(parser);
  return parseExpressionStatement(parser);
}

function parseExpressionStatement(parser: StatementParser): CastStatement {
  const expression = parser.parseExpression();
  const semi = parser.expectText(";");
  return { kind: "ExpressionStmt", expression, span: span(expression.span.start, semi.span.end) };
}

function parseReturn(parser: StatementParser): CastStatement {
  const start = parser.expectText("return");
  const expression = parser.checkText(";") ? null : parser.parseExpression();
  const semi = parser.expectText(";");
  return { kind: "ReturnStmt", expression, span: span(start.span.start, semi.span.end) };
}

function parseIf(parser: StatementParser): CastStatement {
  const start = parser.expectText("if");
  const condition = parseCondition(parser);
  const thenBody = parser.parseBlock();
  const elseBody = parser.matchText("else") ? parser.parseBlock() : null;
  const end = elseBody?.span.end ?? thenBody.span.end;
  return { kind: "IfStmt", condition, thenBody, elseBody, span: span(start.span.start, end) };
}

function parseWhile(parser: StatementParser): CastStatement {
  const start = parser.expectText("while");
  const condition = parseCondition(parser);
  const body = parser.parseBlock();
  return { kind: "WhileStmt", condition, body, span: span(start.span.start, body.span.end) };
}

function parseCondition(parser: StatementParser): CastExpression {
  parser.expectText("(");
  const condition = parser.parseExpression();
  parser.expectText(")");
  return condition;
}

function parseAssignment(parser: StatementParser): CastStatement {
  const name = parser.expectKind("identifier", "Expected assignment target");
  parser.expectText("=");
  const expression = parser.parseExpression();
  const semi = parser.expectText(";");
  return { kind: "AssignmentStmt", name: name.text, expression, span: span(name.span.start, semi.span.end) };
}

function parseVarDecl(parser: StatementParser): CastStatement {
  const keyword = parser.advance();
  const name = parser.expectKind("identifier", "Expected variable name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  parser.expectText("=");
  const initializer = parser.parseExpression();
  const semi = parser.expectText(";");
  return {
    kind: "VarDeclStmt",
    mutable: keyword.text === "let",
    name: name.text,
    type,
    initializer,
    span: span(keyword.span.start, semi.span.end),
  };
}

function isVariableDeclarationStart(parser: StatementParser): b8 {
  return parser.checkText("let") || parser.checkText("const");
}

function isAssignmentStart(parser: StatementParser): b8 {
  return parser.check("identifier") && parser.peek(1).text === "=";
}
