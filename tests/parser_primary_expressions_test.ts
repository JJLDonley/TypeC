import type { Diagnostic } from "core/diagnostics.ts";
import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parsePrimaryWith, type PrimaryExpressionParser } from "parser/primary_expressions.ts";

type Str = string;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses primary literals", () => {
  assertText(parsePrimaryWith(parserFor([token("integer", "42")])).kind, "IntegerLiteral");
  assertText(parsePrimaryWith(parserFor([token("float", "1.5")])).kind, "FloatLiteral");
  assertText(parsePrimaryWith(parserFor([token("keyword", "true")])).kind, "BoolLiteral");
  assertText(parsePrimaryWith(parserFor([token("string", "hi")])).kind, "StringLiteral");
});

Deno.test("parses identifier calls", () => {
  const expr = parsePrimaryWith(
    parserFor([identifier("add"), punct("("), identifier("x"), punct(")")]),
  );

  assertText(expr.kind, "CallExpr");
});

Deno.test("reports missing primary expressions", () => {
  const fixture = parserFixture([punct(";")]);

  try {
    parsePrimaryWith(fixture.parser);
  } catch (_error) {
    assertText(fixture.diagnostics[0]?.message ?? "", "Expected expression");
    return;
  }
  throw new Error("Expected parse error");
});

interface ParserFixture {
  diagnostics: Diagnostic[];
  parser: PrimaryExpressionParser;
}

function parserFor(tokens: Token[]): PrimaryExpressionParser {
  return parserFixture(tokens).parser;
}

function parserFixture(tokens: Token[]): ParserFixture {
  let current: i32 = 0;
  const diagnostics: Diagnostic[] = [];
  const parser: PrimaryExpressionParser = {
    diagnostics: () => diagnostics,
    check: (kind) => peek(tokens, current).kind === kind,
    checkText: (text) => peek(tokens, current).text === text,
    matchText: (text) => {
      if (peek(tokens, current).text !== text) return false;
      current += 1;
      return true;
    },
    advance: () => {
      current += 1;
      return peek(tokens, current - 1);
    },
    expectKind: (kind, message) => {
      const next = peek(tokens, current);
      if (next.kind !== kind) throw new Error(message);
      current += 1;
      return next;
    },
    expectText: (text) => {
      const next = peek(tokens, current);
      if (next.text !== text) throw new Error(`Expected '${text}'`);
      current += 1;
      return next;
    },
    peek: () => peek(tokens, current),
    error: (next, message) => diagnostics.push({ message, span: next.span }),
    parseExpression: () => parsePrimaryWith(parser),
    parseArrayLiteral: () => ({ kind: "ArrayLiteralExpr", elements: [], span: sourceSpan }),
    parseRecordLiteral: () => ({ kind: "RecordLiteralExpr", fields: [], span: sourceSpan }),
  };
  return { diagnostics, parser };
}

function peek(tokens: Token[], index: i32): Token {
  return tokens[index] ?? eof();
}

function identifier(text: Str): Token {
  return token("identifier", text);
}

function punct(text: Str): Token {
  return token("punctuation", text);
}

function eof(): Token {
  return token("eof", "");
}

function token(kind: TokenKind, text: Str): Token {
  return { kind, text, span: sourceSpan };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
