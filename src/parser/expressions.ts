import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { precedence, span } from "parser/helpers.ts";

type Str = string;
type i32 = number;
type b8 = boolean;

export interface ExpressionParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  peek(): Token;
  advance(): Token;
  parsePostfixExpression(): CastExpression;
}

export function parseExpressionWith(
  parser: ExpressionParser,
  minPrecedence: i32 = 0,
): CastExpression {
  let expr = parseUnaryExpression(parser);
  while (hasOperatorAtPrecedence(parser, minPrecedence)) expr = parseBinaryExpression(parser, expr);
  return expr;
}

function parseUnaryExpression(parser: ExpressionParser): CastExpression {
  if (!isUnaryOperator(parser)) return parser.parsePostfixExpression();
  const operator = parser.advance();
  const operand = parseExpressionWith(parser, 4);
  return {
    kind: "UnaryExpr",
    operator: operator.text as "+" | "-" | "!",
    operand,
    span: span(operator.span.start, operand.span.end),
  };
}

function isUnaryOperator(parser: ExpressionParser): b8 {
  return parser.checkText("+") || parser.checkText("-") || parser.checkText("!");
}

function parseBinaryExpression(parser: ExpressionParser, left: CastExpression): CastExpression {
  const op = parser.advance();
  const rhs = parseExpressionWith(parser, precedence(op.text) + 1);
  return {
    kind: "BinaryExpr",
    operator: op.text,
    left,
    right: rhs,
    span: span(left.span.start, rhs.span.end),
  };
}

function hasOperatorAtPrecedence(parser: ExpressionParser, minPrecedence: i32): b8 {
  return parser.check("operator") && precedence(parser.peek().text) >= minPrecedence;
}
