import type { CastExpression, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { type ParamParser, parseParamsWith } from "parser/params.ts";

type Str = string;
type i32 = number;
type usize = number;
type b8 = boolean;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses function params", () => {
  const parser = parserFor([
    identifier("a"),
    punct(":"),
    identifier("i32"),
    punct(","),
    identifier("b"),
    punct(":"),
    identifier("f64"),
    punct(")"),
  ]);

  const params = parseParamsWith(parser);

  assertLen(params.length, 2);
  assertText(params[0]?.name ?? "", "a");
  assertText(typeName(params[0]?.type), "i32");
  assertText(params[1]?.name ?? "", "b");
  assertText(typeName(params[1]?.type), "f64");
});

Deno.test("parses empty function params", () => {
  const parser = parserFor([punct(")")]);

  const params = parseParamsWith(parser);

  assertLen(params.length, 0);
});

Deno.test("parses optional and default function params", () => {
  const parser = parserFor([
    identifier("prefix"),
    punct("?"),
    punct(":"),
    identifier("i32"),
    punct(","),
    identifier("value"),
    punct(":"),
    identifier("i32"),
    punct("="),
    integer("42"),
    punct(")"),
  ]);

  const params = parseParamsWith(parser);

  assertLen(params.length, 2);
  assertBool(params[0]?.optional === true, true);
  assertText(params[1]?.defaultValue?.kind ?? "", "IntegerLiteral");
});

Deno.test("parses trailing comma function params", () => {
  const parser = parserFor([
    identifier("value"),
    punct(":"),
    identifier("i32"),
    punct(","),
    punct(")"),
  ]);

  const params = parseParamsWith(parser);

  assertLen(params.length, 1);
  assertText(params[0]?.name ?? "", "value");
});

function parserFor(tokens: Token[]): ParamParser {
  let current: i32 = 0;
  return {
    checkText: (text) => tokens[current]?.text === text,
    matchText: (text) => {
      if (tokens[current]?.text !== text) return false;
      current += 1;
      return true;
    },
    expectKind: (kind, message) => {
      const token = tokens[current] ?? eof();
      if (token.kind !== kind) throw new Error(message);
      current += 1;
      return token;
    },
    expectText: (text) => {
      const token = tokens[current] ?? eof();
      if (token.text !== text) throw new Error(`Expected '${text}'`);
      current += 1;
      return token;
    },
    parseTypeRef: () => {
      const token = tokens[current] ?? eof();
      if (token.kind !== "identifier") throw new Error("Expected type name");
      current += 1;
      return { kind: "NamedTypeRef", name: token.text, span: token.span };
    },
    parseExpression: () => parseInteger(tokens, current, (next) => current = next),
  };
}

function typeName(type: CastTypeRef | undefined): Str {
  if (!type || type.kind !== "NamedTypeRef") return "";
  return type.name;
}

function parseInteger(
  tokens: Token[],
  current: i32,
  setCurrent: (next: i32) => void,
): CastExpression {
  const token = tokens[current] ?? eof();
  setCurrent(current + 1);
  return { kind: "IntegerLiteral", value: BigInt(token.text), text: token.text, span: token.span };
}

function identifier(text: Str): Token {
  return token("identifier", text);
}

function integer(text: Str): Token {
  return token("integer", text);
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

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
