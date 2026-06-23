import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export interface AggregateLiteralParser {
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  parseExpression(): CastExpression;
}

export function parseArrayLiteralWith(parser: AggregateLiteralParser): CastExpression {
  const open = parser.expectText("[");
  const elements: CastExpression[] = [];
  if (!parser.checkText("]")) {
    do {
      if (parser.checkText("]")) break;
      elements.push(parser.parseExpression());
    } while (parser.matchText(","));
  }
  const close = parser.expectText("]");
  return { kind: "ArrayLiteralExpr", elements, span: span(open.span.start, close.span.end) };
}

export function parseRecordLiteralWith(parser: AggregateLiteralParser): CastExpression {
  const open = parser.expectText("{");
  const fields: Extract<CastExpression, { kind: "RecordLiteralExpr" }>["fields"] = [];
  if (!parser.checkText("}")) {
    do {
      if (parser.checkText("}")) break;
      fields.push(parseRecordLiteralField(parser));
    } while (parser.matchText(","));
  }
  const close = parser.expectText("}");
  return { kind: "RecordLiteralExpr", fields, span: span(open.span.start, close.span.end) };
}

function parseRecordLiteralField(
  parser: AggregateLiteralParser,
): Extract<CastExpression, { kind: "RecordLiteralExpr" }>["fields"][usize] {
  const name = parser.expectKind("identifier", "Expected field name");
  parser.expectText(":");
  const expression = parser.parseExpression();
  return { name: name.text, expression, span: span(name.span.start, expression.span.end) };
}
