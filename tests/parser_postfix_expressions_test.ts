import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import {
  parsePostfixExpressionWith,
  type PostfixExpressionParser,
} from "parser/postfix_expressions.ts";

type Str = string;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses postfix field and pointer expressions", () => {
  const parser = parserFor([
    identifier("value"),
    punct("."),
    identifier("field"),
    punct(".&"),
    eof(),
  ]);

  const expr = parsePostfixExpressionWith(parser);

  assertText(expr.kind, "PostfixPointerExpr");
  if (expr.kind !== "PostfixPointerExpr") throw new Error("Expected postfix pointer");
  assertText(expr.operator, ".&");
  assertText(expr.operand.kind, "FieldAccessExpr");
});

Deno.test("parses postfix array length expressions", () => {
  const parser = parserFor([
    identifier("items"),
    punct("."),
    identifier("length"),
    punct("("),
    punct(")"),
    eof(),
  ]);

  const expr = parsePostfixExpressionWith(parser);

  assertText(expr.kind, "FieldAccessExpr");
  if (expr.kind !== "FieldAccessExpr") throw new Error("Expected field access");
  assertText(expr.field, "length()");
});

Deno.test("parses postfix index expressions", () => {
  const parser = parserFor([identifier("items"), punct("["), identifier("i"), punct("]"), eof()]);

  const expr = parsePostfixExpressionWith(parser);

  assertText(expr.kind, "IndexExpr");
});

Deno.test("parses postfix non-null assertion", () => {
  const parser = parserFor([identifier("value"), operator("!"), eof()]);

  const expr = parsePostfixExpressionWith(parser);

  assertText(expr.kind, "NonNullAssertExpr");
  if (expr.kind !== "NonNullAssertExpr") throw new Error("Expected non-null assertion");
  assertText(expr.operand.kind, "IdentifierExpr");
});

Deno.test("parses optional chaining expressions", () => {
  const field = parsePostfixExpressionWith(
    parserFor([identifier("value"), operator("?."), identifier("x"), eof()]),
  );
  const method = parsePostfixExpressionWith(
    parserFor([
      identifier("value"),
      operator("?."),
      identifier("get"),
      punct("("),
      punct(")"),
      eof(),
    ]),
  );
  const index = parsePostfixExpressionWith(
    parserFor([
      identifier("value"),
      operator("?."),
      punct("["),
      identifier("i"),
      punct("]"),
      eof(),
    ]),
  );

  assertText(field.kind, "OptionalFieldAccessExpr");
  assertText(method.kind, "OptionalMethodCallExpr");
  assertText(index.kind, "OptionalIndexExpr");
});

function parserFor(tokens: Token[]): PostfixExpressionParser {
  let current: i32 = 0;
  return {
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
    expectText: (text) => {
      const token = peek(tokens, current);
      if (token.text !== text) throw new Error(`Expected '${text}'`);
      current += 1;
      return token;
    },
    expectKind: (kind, message) => {
      const token = peek(tokens, current);
      if (token.kind !== kind) throw new Error(message);
      current += 1;
      return token;
    },
    parsePrimary: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected primary");
      current += 1;
      return identifierExpr(token.text);
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

function operator(text: Str): Token {
  return token("operator", text);
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
