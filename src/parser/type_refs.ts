import type { CastParam, CastRecordField, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { optionalTypeRefWithEnd } from "core/optional_types.ts";
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
  let type: CastTypeRef = parser.checkText("{")
    ? parseRecordTypeRef(parser)
    : parser.checkText("(")
    ? parseFunctionTypeRef(parser)
    : parseNamedTypeRef(parser);

  while (isTypePostfixStart(parser)) {
    if (parser.matchText("*")) {
      type = {
        kind: "PointerTypeRef",
        element: type,
        span: span(type.span.start, parser.previous().span.end),
      };
      continue;
    }
    if (parser.matchText("&")) {
      type = {
        kind: "ReferenceTypeRef",
        element: type,
        span: span(type.span.start, parser.previous().span.end),
      };
      continue;
    }
    if (parser.matchText("?")) {
      type = optionalTypeRefWithEnd(type, parser.previous().span.end);
      continue;
    }
    type = parseArrayTypeRef(parser, type);
  }

  return type;
}

function parseNamedTypeRef(parser: TypeRefParser): CastTypeRef {
  const token = parser.expectKind("identifier", "Expected type name");
  if (isCanonicalGenericType(token.text) && parser.matchText("<")) {
    return parseCanonicalGenericTypeRef(parser, token);
  }
  if (parser.matchText(".")) return parseQualifiedNamedTypeRef(parser, token);
  if (parser.matchText("<")) return parseGenericNamedTypeRef(parser, token);
  return { kind: "NamedTypeRef", name: token.text, span: token.span };
}

function parseGenericNamedTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const typeArgs: CastTypeRef[] = [];
  do {
    typeArgs.push(parseTypeRefWith(parser));
    if (!parser.matchText(",")) break;
    if (parser.checkText(">")) break;
  } while (true);
  const close = parser.expectText(">");
  return {
    kind: "NamedTypeRef",
    name: token.text,
    typeArgs,
    span: span(token.span.start, close.span.end),
  };
}

function parseQualifiedNamedTypeRef(parser: TypeRefParser, namespace: Token): CastTypeRef {
  const member = parser.expectKind("identifier", "Expected qualified type name");
  return {
    kind: "NamedTypeRef",
    name: `${namespace.text}.${member.text}`,
    span: span(namespace.span.start, member.span.end),
  };
}

function parseCanonicalGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  if (token.text === "Ptr") return parsePointerGenericTypeRef(parser, token);
  if (token.text === "Ref") return parseReferenceGenericTypeRef(parser, token);
  if (token.text === "SafePtr") return parseSafePointerGenericTypeRef(parser, token);
  if (token.text === "Slice") return parseSliceGenericTypeRef(parser, token);
  return parseArrayGenericTypeRef(parser, token);
}

function parsePointerGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  parser.matchText(",");
  const close = parser.expectText(">");
  return { kind: "PointerTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseReferenceGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  parser.matchText(",");
  const close = parser.expectText(">");
  return { kind: "ReferenceTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseSafePointerGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  parser.matchText(",");
  const close = parser.expectText(">");
  return { kind: "SafePointerTypeRef", element, span: span(token.span.start, close.span.end) };
}

function parseSliceGenericTypeRef(parser: TypeRefParser, token: Token): CastTypeRef {
  const element = parseTypeRefWith(parser);
  parser.matchText(",");
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
  parser.matchText(",");
  const close = parser.expectText(">");
  return {
    kind: "FixedArrayTypeRef",
    element,
    sizeText: size.text,
    span: span(token.span.start, close.span.end),
  };
}

function isCanonicalGenericType(name: Str): b8 {
  return name === "Ptr" || name === "Ref" || name === "SafePtr" || name === "Array" ||
    name === "Slice";
}

function parseArrayTypeRef(parser: TypeRefParser, element: CastTypeRef): CastTypeRef {
  parser.expectText("[");
  if (parser.matchText("]")) {
    return {
      kind: "InferredArrayTypeRef",
      element,
      span: span(element.span.start, parser.previous().span.end),
    };
  }

  const size = parser.expectKind("integer", "Expected array size");
  const close = parser.expectText("]");
  return {
    kind: "FixedArrayTypeRef",
    element,
    sizeText: size.text,
    span: span(element.span.start, close.span.end),
  };
}

function parseFunctionTypeRef(parser: TypeRefParser): CastTypeRef {
  const open = parser.expectText("(");
  const params = parseFunctionTypeParams(parser);
  parser.expectText("=>");
  const returnType = parseTypeRefWith(parser);
  return {
    kind: "FunctionTypeRef",
    params,
    returnType,
    span: span(open.span.start, returnType.span.end),
  };
}

function parseFunctionTypeParams(parser: TypeRefParser): CastParam[] {
  const params: CastParam[] = [];
  if (!parser.checkText(")")) {
    do {
      if (parser.checkText(")")) break;
      params.push(parseFunctionTypeParam(parser));
    } while (parser.matchText(","));
  }
  parser.expectText(")");
  return params;
}

function parseFunctionTypeParam(parser: TypeRefParser): CastParam {
  const name = parser.expectKind("identifier", "Expected function type parameter name");
  parser.expectText(":");
  const type = parseTypeRefWith(parser);
  return { name: name.text, type, span: span(name.span.start, type.span.end) };
}

function parseRecordTypeRef(parser: TypeRefParser): CastTypeRef {
  const open = parser.expectText("{");
  const fields: CastRecordField[] = [];
  while (!parser.checkText("}") && !parser.check("eof")) {
    fields.push(parseRecordField(parser));
    if (parseRecordFieldSeparator(parser)) continue;
    if (parser.checkText("}")) break;
    parser.expectText(";");
  }
  const close = parser.expectText("}");
  return { kind: "RecordTypeRef", fields, span: span(open.span.start, close.span.end) };
}

function parseRecordField(parser: TypeRefParser): CastRecordField {
  const name = parser.expectKind("identifier", "Expected field name");
  parser.expectText(":");
  const type = parseTypeRefWith(parser);
  return { name: name.text, type, span: span(name.span.start, type.span.end) };
}

function parseRecordFieldSeparator(parser: TypeRefParser): b8 {
  return parser.matchText(";") || parser.matchText(",");
}

function isTypePostfixStart(parser: TypeRefParser): b8 {
  return parser.checkText("*") || parser.checkText("&") || parser.checkText("[") ||
    parser.checkText("?");
}
