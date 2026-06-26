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

Deno.test("parses cast expressions", () => {
  const atCast = parseExpressionWith(parserFor([
    punctuation("@"),
    identifier("f32"),
    punctuation("("),
    identifier("value"),
    punctuation(")"),
  ]));
  const asCast = parseExpressionWith(
    parserFor([identifier("value"), keyword("as"), identifier("i32")]),
  );

  assertText(atCast.kind, "CastExpr");
  assertText(asCast.kind, "CastExpr");
});

Deno.test("parses logical not expressions", () => {
  const expr = parseExpressionWith(parserFor([operator("!"), operator("!"), identifier("a")]));

  assertText(expr.kind, "UnaryExpr");
  if (expr.kind !== "UnaryExpr") throw new Error("Expected unary expression");
  assertText(expr.operator, "!");
  assertText(expr.operand.kind, "UnaryExpr");
});

Deno.test("parses bitwise expressions", () => {
  const unary = parseExpressionWith(
    parserFor([operator("~"), identifier("a"), operator("&"), identifier("b")]),
  );
  const shift = parseExpressionWith(
    parserFor([identifier("a"), operator("<<"), identifier("b"), operator("|"), identifier("c")]),
  );

  assertText(unary.kind, "BinaryExpr");
  if (unary.kind !== "BinaryExpr") throw new Error("Expected binary expression");
  assertText(unary.operator, "&");
  assertText(unary.left.kind, "UnaryExpr");
  assertText(shift.kind, "BinaryExpr");
  if (shift.kind !== "BinaryExpr") throw new Error("Expected binary expression");
  assertText(shift.operator, "|");
  assertText(shift.left.kind, "BinaryExpr");
});

Deno.test("parses logical binary expressions", () => {
  const expr = parseExpressionWith(parserFor([
    identifier("a"),
    operator("||"),
    identifier("b"),
    operator("&&"),
    identifier("c"),
  ]));

  assertText(expr.kind, "BinaryExpr");
  if (expr.kind !== "BinaryExpr") throw new Error("Expected binary expression");
  assertText(expr.operator, "||");
  assertText(expr.right.kind, "BinaryExpr");
});

Deno.test("parses conditional expressions", () => {
  const expr = parseExpressionWith(parserFor([
    identifier("a"),
    operator("=="),
    identifier("b"),
    punctuation("?"),
    identifier("c"),
    punctuation(":"),
    identifier("d"),
  ]));

  assertText(expr.kind, "ConditionalExpr");
  if (expr.kind !== "ConditionalExpr") throw new Error("Expected conditional expression");
  assertText(expr.condition.kind, "BinaryExpr");
  assertText(expr.whenTrue.kind, "IdentifierExpr");
  assertText(expr.whenFalse.kind, "IdentifierExpr");
});

Deno.test("parses nullish coalescing expressions", () => {
  const nullish = parseExpressionWith(
    parserFor([identifier("a"), operator("??"), identifier("b")]),
  );
  const elvis = parseExpressionWith(parserFor([
    identifier("a"),
    punctuation("?"),
    punctuation(":"),
    identifier("b"),
  ]));

  assertText(nullish.kind, "NullishCoalesceExpr");
  if (nullish.kind !== "NullishCoalesceExpr") throw new Error("Expected nullish expression");
  assertText(nullish.operator, "??");
  assertText(elvis.kind, "NullishCoalesceExpr");
  if (elvis.kind !== "NullishCoalesceExpr") throw new Error("Expected Elvis expression");
  assertText(elvis.operator, "?:");
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
    peek: (offset = 0) => peek(tokens, current + offset),
    advance: () => {
      current += 1;
      return peek(tokens, current - 1);
    },
    expectText: (text) => {
      const token = peek(tokens, current);
      if (token.text !== text) throw new Error(`Expected ${text}`);
      current += 1;
      return token;
    },
    parseTypeRef: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected type");
      current += 1;
      return { kind: "NamedTypeRef", name: token.text, span: token.span };
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

function keyword(text: Str): Token {
  return token("keyword", text);
}

function punctuation(text: Str): Token {
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
