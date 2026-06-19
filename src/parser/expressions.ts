import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { precedence, span } from "parser/helpers.ts";

type i32 = number;
type b8 = boolean;

export interface ExpressionParser {
  check(kind: TokenKind): b8;
  peek(): Token;
  advance(): Token;
  parsePostfixExpression(): CastExpression;
}

export function parseExpressionWith(parser: ExpressionParser, minPrecedence: i32 = 0): CastExpression {
  let expr = parser.parsePostfixExpression();
  while (hasOperatorAtPrecedence(parser, minPrecedence)) expr = parseBinaryExpression(parser, expr);
  return expr;
}

function parseBinaryExpression(parser: ExpressionParser, left: CastExpression): CastExpression {
  const op = parser.advance();
  const rhs = parseExpressionWith(parser, precedence(op.text) + 1);
  return { kind: "BinaryExpr", operator: op.text, left, right: rhs, span: span(left.span.start, rhs.span.end) };
}

function hasOperatorAtPrecedence(parser: ExpressionParser, minPrecedence: i32): b8 {
  return parser.check("operator") && precedence(parser.peek().text) >= minPrecedence;
}
