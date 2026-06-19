import type { CastParam, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;

export interface ParamParser {
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  parseTypeRef(): CastTypeRef;
}

export function parseParamsWith(parser: ParamParser): CastParam[] {
  const params: CastParam[] = [];
  if (parser.checkText(")")) return params;
  do params.push(parseParam(parser));
  while (parser.matchText(","));
  return params;
}

function parseParam(parser: ParamParser): CastParam {
  const name = parser.expectKind("identifier", "Expected parameter name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  return { name: name.text, type, span: span(name.span.start, type.span.end) };
}
