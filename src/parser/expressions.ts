import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { precedence, span } from "parser/helpers.ts";

type Str = string;
type i32 = number;
type b8 = boolean;

export interface ExpressionParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  peek(offset?: i32): Token;
  advance(): Token;
  expectText(text: Str): Token;
  parsePostfixExpression(): CastExpression;
}

export function parseExpressionWith(
  parser: ExpressionParser,
  minPrecedence: i32 = 0,
): CastExpression {
  let expr = parseBinaryPrecedenceExpression(parser, minPrecedence);
  if (minPrecedence <= 0 && isElvisExpression(parser)) expr = parseElvisExpression(parser, expr);
  if (minPrecedence <= 0 && parser.checkText("?")) expr = parseConditionalExpression(parser, expr);
  return expr;
}

function parseBinaryPrecedenceExpression(
  parser: ExpressionParser,
  minPrecedence: i32,
): CastExpression {
  let expr = parseUnaryExpression(parser);
  while (hasOperatorAtPrecedence(parser, minPrecedence)) expr = parseBinaryExpression(parser, expr);
  return expr;
}

function parseUnaryExpression(parser: ExpressionParser): CastExpression {
  if (!isUnaryOperator(parser)) return parser.parsePostfixExpression();
  const operator = parser.advance();
  const operand = parseExpressionWith(parser, 21);
  return {
    kind: "UnaryExpr",
    operator: operator.text as "+" | "-" | "!" | "~",
    operand,
    span: span(operator.span.start, operand.span.end),
  };
}

function isUnaryOperator(parser: ExpressionParser): b8 {
  return parser.checkText("+") || parser.checkText("-") || parser.checkText("!") ||
    parser.checkText("~");
}

function parseConditionalExpression(
  parser: ExpressionParser,
  condition: CastExpression,
): CastExpression {
  parser.advance();
  const whenTrue = parseExpressionWith(parser);
  parser.expectText(":");
  const whenFalse = parseExpressionWith(parser);
  return {
    kind: "ConditionalExpr",
    condition,
    whenTrue,
    whenFalse,
    span: span(condition.span.start, whenFalse.span.end),
  };
}

function parseElvisExpression(parser: ExpressionParser, left: CastExpression): CastExpression {
  parser.expectText("?");
  parser.expectText(":");
  const fallback = parseExpressionWith(parser, 1);
  return {
    kind: "NullishCoalesceExpr",
    operator: "?:",
    left,
    fallback,
    span: span(left.span.start, fallback.span.end),
  };
}

function isElvisExpression(parser: ExpressionParser): b8 {
  return parser.peek().text === "?" && parser.peek(1).text === ":";
}

function parseBinaryExpression(parser: ExpressionParser, left: CastExpression): CastExpression {
  const op = parser.advance();
  const rhs = parseExpressionWith(parser, precedence(op.text) + 1);
  if (op.text === "??") {
    return {
      kind: "NullishCoalesceExpr",
      operator: "??",
      left,
      fallback: rhs,
      span: span(left.span.start, rhs.span.end),
    };
  }
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
