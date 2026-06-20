import type { CastRecordField, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;

export interface TypeRefParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  previous(): Token;
}

export function parseTypeRefWith(parser: TypeRefParser): CastTypeRef {
  let type: CastTypeRef = parser.checkText("{") ? parseRecordTypeRef(parser) : parseNamedTypeRef(parser);

  while (isTypePostfixStart(parser)) {
    if (parser.matchText("*")) {
      type = { kind: "PointerTypeRef", element: type, span: span(type.span.start, parser.previous().span.end) };
      continue;
    }
    if (parser.matchText("&")) {
      type = { kind: "ReferenceTypeRef", element: type, span: span(type.span.start, parser.previous().span.end) };
      continue;
    }
    type = parseArrayTypeRef(parser, type);
  }

  return type;
}

function parseNamedTypeRef(parser: TypeRefParser): CastTypeRef {
  const token = parser.expectKind("identifier", "Expected type name");
  if (isCanonicalGenericType(token.text) && parser.matchText("<")) return parseCanonicalGenericTypeRef(parser, token);
  return { kind: "NamedTypeRef", name: token.text, span: token.span };
}

function parseCanonicalGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  if (token.text === "Ptr") return parsePointerGenericTypeRef(parser, token);
  if (token.text === "Ref") return parseReferenceGenericTypeRef(parser, token);
  if (token.text === "Slice") return parseSliceGenericTypeRef(parser, token);
  return parseArrayGenericTypeRef(parser, token);
}

function parsePointerGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  const close = parser.expectText(">");
  return { kind: "PointerTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseReferenceGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  const close = parser.expectText(">");
  return { kind: "ReferenceTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseSliceGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  const close = parser.expectText(">");
  return { kind: "SliceTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseArrayGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  if (!parser.matchText(",")) {
    const close = parser.expectText(">");
    return { kind: "InferredArrayTypeRef", element, span: span(token.span.start, close.span.end) };
  }
  const size = parser.expectKind("integer", "Expected array size");
  const close = parser.expectText(">");
  return { kind: "FixedArrayTypeRef", element, sizeText: size.text, span: span(token.span.start, close.span.end) };
}

function isCanonicalGenericType(name: Str): b8 {
  return name === "Ptr" || name === "Ref" || name === "Array" || name === "Slice";
}

function parseArrayTypeRef(parser: TypeRefParser, element: CastTypeRef): CastTypeRef {
  parser.expectText("[");
  if (parser.matchText("]")) {
    return { kind: "InferredArrayTypeRef", element, span: span(element.span.start, parser.previous().span.end) };
  }

  const size = parser.expectKind("integer", "Expected array size");
  const close = parser.expectText("]");
  return { kind: "FixedArrayTypeRef", element, sizeText: size.text, span: span(element.span.start, close.span.end) };
}

function parseRecordTypeRef(parser: TypeRefParser): CastTypeRef {
  const open = parser.expectText("{");
  const fields: CastRecordField[] = [];
  while (!parser.checkText("}") && !parser.check("eof")) fields.push(parseRecordField(parser));
  const close = parser.expectText("}");
  return { kind: "RecordTypeRef", fields, span: span(open.span.start, close.span.end) };
}

function parseRecordField(parser: TypeRefParser): CastRecordField {
  const name = parser.expectKind("identifier", "Expected field name");
  parser.expectText(":");
  const type = parseTypeRefWith(parser);
  const semi = parser.expectText(";");
  return { name: name.text, type, span: span(name.span.start, semi.span.end) };
}

function isTypePostfixStart(parser: TypeRefParser): b8 {
  return parser.checkText("*") || parser.checkText("&") || parser.checkText("[");
}
