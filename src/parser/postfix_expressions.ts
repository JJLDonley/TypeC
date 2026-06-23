import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;

export interface PostfixExpressionParser {
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  advance(): Token;
  expectText(text: Str): Token;
  expectKind(kind: TokenKind, message: Str): Token;
  parsePrimary(): CastExpression;
  parseExpression(): CastExpression;
}

export function parsePostfixExpressionWith(parser: PostfixExpressionParser): CastExpression {
  let expr = parser.parsePrimary();
  while (isPostfixStart(parser)) expr = parsePostfix(parser, expr);
  return expr;
}

function parsePostfix(parser: PostfixExpressionParser, operand: CastExpression): CastExpression {
  if (parser.checkText(".")) return parseFieldAccess(parser, operand);
  if (parser.checkText("[")) return parseIndexAccess(parser, operand);
  if (parser.checkText("!")) return parseNonNullAssertion(parser, operand);
  return parsePointerPostfix(parser, operand);
}

function parseFieldAccess(
  parser: PostfixExpressionParser,
  operand: CastExpression,
): CastExpression {
  const field = parseFieldAccessName(parser);
  if (field.text === "length" && parser.matchText("(")) {
    const close = parser.expectText(")");
    return {
      kind: "FieldAccessExpr",
      operand,
      field: "length()",
      span: span(operand.span.start, close.span.end),
    };
  }
  if (parser.matchText("(")) return parseMethodCall(parser, operand, field);
  return {
    kind: "FieldAccessExpr",
    operand,
    field: field.text,
    span: span(operand.span.start, field.span.end),
  };
}

function parseMethodCall(
  parser: PostfixExpressionParser,
  receiver: CastExpression,
  method: Token,
): CastExpression {
  const args = parseCallArguments(parser);
  const close = parser.expectText(")");
  return {
    kind: "MethodCallExpr",
    receiver,
    method: method.text,
    args,
    span: span(receiver.span.start, close.span.end),
  };
}

function parseCallArguments(parser: PostfixExpressionParser): CastExpression[] {
  const args: CastExpression[] = [];
  if (!parser.checkText(")")) {
    do args.push(parser.parseExpression()); while (parser.matchText(","));
  }
  return args;
}

function parseIndexAccess(
  parser: PostfixExpressionParser,
  operand: CastExpression,
): CastExpression {
  const close = parseIndexClose(parser);
  return {
    kind: "IndexExpr",
    operand,
    index: close.index,
    span: span(operand.span.start, close.end.span.end),
  };
}

function parsePointerPostfix(
  parser: PostfixExpressionParser,
  operand: CastExpression,
): CastExpression {
  const op = parser.advance();
  return {
    kind: "PostfixPointerExpr",
    operator: op.text as ".*" | ".&",
    operand,
    span: span(operand.span.start, op.span.end),
  };
}

function parseNonNullAssertion(
  parser: PostfixExpressionParser,
  operand: CastExpression,
): CastExpression {
  const op = parser.expectText("!");
  return { kind: "NonNullAssertExpr", operand, span: span(operand.span.start, op.span.end) };
}

function parseFieldAccessName(parser: PostfixExpressionParser): Token {
  parser.expectText(".");
  return parser.expectKind("identifier", "Expected field name");
}

function parseIndexClose(parser: PostfixExpressionParser): { index: CastExpression; end: Token } {
  parser.expectText("[");
  const index = parser.parseExpression();
  const end = parser.expectText("]");
  return { index, end };
}

function isPostfixStart(parser: PostfixExpressionParser): b8 {
  return parser.checkText(".*") || parser.checkText(".&") || parser.checkText(".") ||
    parser.checkText("[") || parser.checkText("!");
}
