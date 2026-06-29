import type { CastParam, CastRecordField, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import type { SourcePos } from "core/diagnostics.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

export interface TypeRefParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  previous(): Token;
  peek(offset?: i32): Token;
}

export function parseTypeRefWith(parser: TypeRefParser): CastTypeRef {
  return parseConditionalTypeRef(parser);
}

function parseConditionalTypeRef(parser: TypeRefParser): CastTypeRef {
  const checkType: CastTypeRef = parseUnionTypeRef(parser);
  if (!parser.matchText("extends")) return checkType;
  const extendsType: CastTypeRef = parseUnionTypeRef(parser, true);
  parser.expectText("?");
  const trueType: CastTypeRef = parseTypeRefWith(parser);
  parser.expectText(":");
  const falseType: CastTypeRef = parseTypeRefWith(parser);
  return {
    kind: "ConditionalTypeRef",
    checkType,
    extendsType,
    trueType,
    falseType,
    span: span(checkType.span.start, falseType.span.end),
  };
}

function parseUnionTypeRef(parser: TypeRefParser, stopQuestion: b8 = false): CastTypeRef {
  const first: CastTypeRef = parseIntersectionTypeRef(parser, stopQuestion);
  if (!parser.matchText("|")) return first;
  const members: CastTypeRef[] = [first];
  do {
    members.push(parseIntersectionTypeRef(parser, stopQuestion));
  } while (parser.matchText("|"));
  const last: CastTypeRef = members[members.length - 1]!;
  return { kind: "UnionTypeRef", members, span: span(first.span.start, last.span.end) };
}

function parseIntersectionTypeRef(parser: TypeRefParser, stopQuestion: b8 = false): CastTypeRef {
  const first: CastTypeRef = parsePostfixTypeRef(parser, stopQuestion);
  if (!parser.matchText("&")) return first;
  const members: CastTypeRef[] = [first];
  do {
    members.push(parsePostfixTypeRef(parser, stopQuestion));
  } while (parser.matchText("&"));
  const last: CastTypeRef = members[members.length - 1]!;
  return { kind: "IntersectionTypeRef", members, span: span(first.span.start, last.span.end) };
}

function parsePostfixTypeRef(parser: TypeRefParser, stopQuestion: b8 = false): CastTypeRef {
  let type: CastTypeRef = parser.checkText("keyof")
    ? parseKeyofTypeRef(parser)
    : parser.checkText("typeof")
    ? parseTypeofTypeRef(parser)
    : parser.checkText("{")
    ? parseRecordTypeRef(parser)
    : parser.checkText("[")
    ? parseTupleTypeRef(parser)
    : parser.checkText("(")
    ? parseParenthesizedOrFunctionTypeRef(parser)
    : isLiteralTypeStart(parser)
    ? parseLiteralTypeRef(parser)
    : parseNamedTypeRef(parser);

  while (isTypePostfixStart(parser, stopQuestion)) {
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
      type = castOptionalTypeRefWithEnd(type, parser.previous().span.end);
      continue;
    }
    type = parseBracketPostfixTypeRef(parser, type);
  }

  return type;
}

function castOptionalTypeRefWithEnd(element: CastTypeRef, end: SourcePos): CastTypeRef {
  return {
    kind: "NamedTypeRef",
    name: "Optional",
    typeArgs: [element],
    span: { start: element.span.start, end },
  };
}

function parseKeyofTypeRef(parser: TypeRefParser): CastTypeRef {
  const start = parser.expectText("keyof");
  const target = parsePostfixTypeRef(parser);
  return { kind: "KeyofTypeRef", target, span: span(start.span.start, target.span.end) };
}

function parseTypeofTypeRef(parser: TypeRefParser): CastTypeRef {
  const start = parser.expectText("typeof");
  const name = parseQualifiedTypeofName(parser);
  return { kind: "TypeofTypeRef", name: name.text, span: span(start.span.start, name.span.end) };
}

function parseQualifiedTypeofName(parser: TypeRefParser): { text: Str; span: CastTypeRef["span"] } {
  const first = parser.expectKind("identifier", "Expected value name");
  let text = first.text;
  let end = first.span.end;
  while (parser.matchText(".")) {
    const part = parser.expectKind("identifier", "Expected qualified value name");
    text = `${text}.${part.text}`;
    end = part.span.end;
  }
  return { text, span: span(first.span.start, end) };
}

function isLiteralTypeStart(parser: TypeRefParser): b8 {
  return parser.check("string") || parser.check("integer") || parser.checkText("true") ||
    parser.checkText("false");
}

function parseLiteralTypeRef(parser: TypeRefParser): CastTypeRef {
  if (parser.check("string")) return parseStringLiteralTypeRef(parser);
  if (parser.check("integer")) return parseIntegerLiteralTypeRef(parser);
  return parseBoolLiteralTypeRef(parser);
}

function parseStringLiteralTypeRef(parser: TypeRefParser): CastTypeRef {
  const token = parser.expectKind("string", "Expected string literal type");
  return { kind: "LiteralTypeRef", value: token.text, text: token.text, span: token.span };
}

function parseIntegerLiteralTypeRef(parser: TypeRefParser): CastTypeRef {
  const token = parser.expectKind("integer", "Expected integer literal type");
  return {
    kind: "LiteralTypeRef",
    value: BigInt(token.text.replaceAll("_", "")),
    text: token.text,
    span: token.span,
  };
}

function parseBoolLiteralTypeRef(parser: TypeRefParser): CastTypeRef {
  const token = parser.matchText("true") ? parser.previous() : parser.expectText("false");
  return {
    kind: "LiteralTypeRef",
    value: token.text === "true",
    text: token.text,
    span: token.span,
  };
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

function parseBracketPostfixTypeRef(parser: TypeRefParser, element: CastTypeRef): CastTypeRef {
  parser.expectText("[");
  if (parser.matchText("]")) return inferredArrayTypeRef(parser, element);
  if (parser.check("identifier")) return parseIndexedAccessTypeRef(parser, element);
  return parseFixedArrayTypeRef(parser, element);
}

function inferredArrayTypeRef(parser: TypeRefParser, element: CastTypeRef): CastTypeRef {
  return {
    kind: "InferredArrayTypeRef",
    element,
    span: span(element.span.start, parser.previous().span.end),
  };
}

function parseIndexedAccessTypeRef(parser: TypeRefParser, objectType: CastTypeRef): CastTypeRef {
  const index = parser.expectKind("identifier", "Expected mapped type key name");
  const close = parser.expectText("]");
  return {
    kind: "IndexedAccessTypeRef",
    objectType,
    indexName: index.text,
    span: span(objectType.span.start, close.span.end),
  };
}

function parseFixedArrayTypeRef(parser: TypeRefParser, element: CastTypeRef): CastTypeRef {
  const size = parser.expectKind("integer", "Expected array size");
  const close = parser.expectText("]");
  return {
    kind: "FixedArrayTypeRef",
    element,
    sizeText: size.text,
    span: span(element.span.start, close.span.end),
  };
}

function parseTupleTypeRef(parser: TypeRefParser): CastTypeRef {
  const open = parser.expectText("[");
  const elements: CastTypeRef[] = [];
  if (!parser.checkText("]")) {
    do {
      if (parser.checkText("]")) break;
      elements.push(parseTypeRefWith(parser));
    } while (parser.matchText(","));
  }
  const close = parser.expectText("]");
  return { kind: "TupleTypeRef", elements, span: span(open.span.start, close.span.end) };
}

function parseParenthesizedOrFunctionTypeRef(parser: TypeRefParser): CastTypeRef {
  return isFunctionTypeStart(parser)
    ? parseFunctionTypeRef(parser)
    : parseParenthesizedTypeRef(parser);
}

function isFunctionTypeStart(parser: TypeRefParser): b8 {
  if (parser.peek(1).text === ")") return parser.peek(2).text === "=>";
  return parser.peek(1).kind === "identifier" && parser.peek(2).text === ":";
}

function parseParenthesizedTypeRef(parser: TypeRefParser): CastTypeRef {
  const open = parser.expectText("(");
  const type = parseTypeRefWith(parser);
  const close = parser.expectText(")");
  return { ...type, span: span(open.span.start, close.span.end) };
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
  if (parser.checkText("[")) return parseMappedTypeRef(parser, open);
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

function parseMappedTypeRef(parser: TypeRefParser, open: Token): CastTypeRef {
  parser.expectText("[");
  const key = parser.expectKind("identifier", "Expected mapped type key name");
  parser.expectText("in");
  parser.expectText("keyof");
  const sourceType = parseTypeRefWith(parser);
  parser.expectText("]");
  parser.expectText(":");
  const valueType = parseTypeRefWith(parser);
  parseRecordFieldSeparator(parser);
  const close = parser.expectText("}");
  return {
    kind: "MappedTypeRef",
    keyName: key.text,
    sourceType,
    valueType,
    span: span(open.span.start, close.span.end),
  };
}

function parseRecordField(parser: TypeRefParser): CastRecordField {
  const readonly = parser.matchText("readonly");
  const start = readonly ? parser.previous().span.start : parser.peek().span.start;
  const name = parser.expectKind("identifier", "Expected field name");
  const optional = parser.matchText("?");
  parser.expectText(":");
  const type = parseTypeRefWith(parser);
  return { name: name.text, type, readonly, optional, span: span(start, type.span.end) };
}

function parseRecordFieldSeparator(parser: TypeRefParser): b8 {
  return parser.matchText(";") || parser.matchText(",");
}

function isTypePostfixStart(parser: TypeRefParser, stopQuestion: b8): b8 {
  return parser.checkText("*") || isReferencePostfix(parser) || parser.checkText("[") ||
    (!stopQuestion && parser.checkText("?"));
}

function isReferencePostfix(parser: TypeRefParser): b8 {
  return parser.checkText("&") && !isTypeStart(parser.peek(1));
}

function isTypeStart(token: Token): b8 {
  return token.kind === "identifier" || token.text === "{" || token.text === "[" ||
    token.text === "(";
}
