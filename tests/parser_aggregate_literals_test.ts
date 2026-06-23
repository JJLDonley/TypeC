import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import {
  type AggregateLiteralParser,
  parseArrayLiteralWith,
  parseRecordLiteralWith,
} from "parser/aggregate_literals.ts";

type Str = string;
type i32 = number;
type usize = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses aggregate array literals", () => {
  const parser = parserFor([punct("["), identifier("a"), punct(","), identifier("b"), punct("]")]);

  const expr = parseArrayLiteralWith(parser);

  assertText(expr.kind, "ArrayLiteralExpr");
  assertLen(expr.kind === "ArrayLiteralExpr" ? expr.elements.length : 0, 2);
});

Deno.test("parses aggregate record literals", () => {
  const parser = parserFor([
    punct("{"),
    identifier("x"),
    punct(":"),
    identifier("value"),
    punct("}"),
  ]);

  const expr = parseRecordLiteralWith(parser);

  assertText(expr.kind, "RecordLiteralExpr");
  assertLen(expr.kind === "RecordLiteralExpr" ? expr.fields.length : 0, 1);
});

function parserFor(tokens: Token[]): AggregateLiteralParser {
  let current: i32 = 0;
  return {
    checkText: (text) => peek(tokens, current).text === text,
    matchText: (text) => {
      if (peek(tokens, current).text !== text) return false;
      current += 1;
      return true;
    },
    expectKind: (kind, message) => {
      const token = peek(tokens, current);
      if (token.kind !== kind) throw new Error(message);
      current += 1;
      return token;
    },
    expectText: (text) => {
      const token = peek(tokens, current);
      if (token.text !== text) throw new Error(`Expected '${text}'`);
      current += 1;
      return token;
    },
    parseExpression: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected expression");
      current += 1;
      return identifierExpr(token.text);
    },
  };
}

function identifierExpr(name: Str): CastExpression {
  return { kind: "IdentifierExpr", name, span: sourceSpan };
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

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
