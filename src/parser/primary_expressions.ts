import { TypeCError } from "core/diagnostics.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parseFloatLiteral, span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;

export interface PrimaryExpressionParser {
  diagnostics(): Diagnostic[];
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  advance(): Token;
  expectText(text: Str): Token;
  peek(): Token;
  error(token: Token, message: Str): void;
  parseExpression(): CastExpression;
  parseArrayLiteral(): CastExpression;
  parseRecordLiteral(): CastExpression;
}

export function parsePrimaryWith(parser: PrimaryExpressionParser): CastExpression {
  if (parser.check("integer")) return parseIntegerLiteral(parser.advance());
  if (parser.check("float")) return parseFloatLiteralExpression(parser, parser.advance());
  if (parser.checkText("true") || parser.checkText("false")) return parseBoolLiteral(parser.advance());
  if (parser.check("string")) return parseStringLiteral(parser.advance());
  if (parser.check("identifier")) return parseIdentifierExpression(parser);
  if (parser.checkText("{")) return parser.parseRecordLiteral();
  if (parser.checkText("[")) return parser.parseArrayLiteral();
  if (parser.matchText("(")) return parseParenthesizedExpression(parser);
  return failExpectedExpression(parser);
}

function parseIntegerLiteral(token: Token): CastExpression {
  return { kind: "IntegerLiteral", value: BigInt(token.text), text: token.text, span: token.span };
}

function parseFloatLiteralExpression(parser: PrimaryExpressionParser, token: Token): CastExpression {
  const value = parseFloatLiteral(token.text);
  if (!Number.isFinite(value)) parser.error(token, `Float literal '${token.text}' is out of range for 'f64'`);
  return { kind: "FloatLiteral", value, text: token.text, span: token.span };
}

function parseBoolLiteral(token: Token): CastExpression {
  return { kind: "BoolLiteral", value: token.text === "true", text: token.text as "true" | "false", span: token.span };
}

function parseStringLiteral(token: Token): CastExpression {
  return { kind: "StringLiteral", text: token.text, span: token.span };
}

function parseParenthesizedExpression(parser: PrimaryExpressionParser): CastExpression {
  const expr = parser.parseExpression();
  parser.expectText(")");
  return expr;
}

function parseIdentifierExpression(parser: PrimaryExpressionParser): CastExpression {
  const ident = parser.advance();
  if (!parser.matchText("(")) return { kind: "IdentifierExpr", name: ident.text, span: ident.span };
  const args = parseCallArguments(parser);
  const close = parser.expectText(")");
  return { kind: "CallExpr", callee: ident.text, args, span: span(ident.span.start, close.span.end) };
}

function parseCallArguments(parser: PrimaryExpressionParser): CastExpression[] {
  const args: CastExpression[] = [];
  if (!parser.checkText(")")) {
    do args.push(parser.parseExpression());
    while (parser.matchText(","));
  }
  return args;
}

function failExpectedExpression(parser: PrimaryExpressionParser): never {
  const token = parser.peek();
  parser.error(token, "Expected expression");
  throw new TypeCError(parser.diagnostics());
}
