import type { CastExpression } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { type ExpressionParser, parseExpressionWith } from "parser/expressions.ts";

type Str = string;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses unary expressions", () => {
  const expr = parseExpressionWith(parserFor([operator("-"), identifier("a")]));

  assertText(expr.kind, "UnaryExpr");
  if (expr.kind !== "UnaryExpr") throw new Error("Expected unary expression");
  assertText(expr.operator, "-");
});

Deno.test("parses binary expressions with precedence", () => {
  const expr = parseExpressionWith(parserFor([
    identifier("a"),
    operator("+"),
    identifier("b"),
    operator("*"),
    identifier("c"),
  ]));

  assertText(expr.kind, "BinaryExpr");
  if (expr.kind !== "BinaryExpr") throw new Error("Expected binary expression");
  assertText(expr.operator, "+");
  assertText(expr.right.kind, "BinaryExpr");
});

Deno.test("parses left associative binary expressions", () => {
  const expr = parseExpressionWith(parserFor([
    identifier("a"),
    operator("-"),
    identifier("b"),
    operator("-"),
    identifier("c"),
  ]));

  assertText(expr.kind, "BinaryExpr");
  if (expr.kind !== "BinaryExpr") throw new Error("Expected binary expression");
  assertText(expr.operator, "-");
  assertText(expr.left.kind, "BinaryExpr");
});

function parserFor(tokens: Token[]): ExpressionParser {
  let current: i32 = 0;
  return {
    check: (kind) => peek(tokens, current).kind === kind,
    checkText: (text) => peek(tokens, current).text === text,
    peek: () => peek(tokens, current),
    advance: () => {
      current += 1;
      return peek(tokens, current - 1);
    },
    parsePostfixExpression: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected identifier");
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
