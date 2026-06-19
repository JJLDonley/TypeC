import type { CastBlockStmt, CastExpression, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parseStatementWith, type StatementParser } from "parser/statements.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses return statements", () => {
  const stmt = parseStatementWith(parserFor([keyword("return"), identifier("value"), punct(";")]));

  assertText(stmt.kind, "ReturnStmt");
});

Deno.test("parses variable declarations", () => {
  const stmt = parseStatementWith(parserFor([keyword("const"), identifier("x"), punct(":"), identifier("i32"), punct("="), identifier("value"), punct(";")]));

  assertText(stmt.kind, "VarDeclStmt");
  if (stmt.kind !== "VarDeclStmt") throw new Error("Expected variable declaration");
  assertBool(stmt.mutable, false);
});

Deno.test("parses assignments before expression statements", () => {
  const stmt = parseStatementWith(parserFor([identifier("x"), punct("="), identifier("value"), punct(";")]));

  assertText(stmt.kind, "AssignmentStmt");
});

Deno.test("parses conditional statements", () => {
  const stmt = parseStatementWith(parserFor([keyword("if"), punct("("), identifier("ok"), punct(")"), punct("{"), punct("}")]));

  assertText(stmt.kind, "IfStmt");
});

function parserFor(tokens: Token[]): StatementParser {
  let current: i32 = 0;
  return {
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
    peek: (offset = 0) => peek(tokens, current + offset),
    parseExpression: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected expression");
      current += 1;
      return identifierExpr(token.text);
    },
    parseTypeRef: () => {
      const token = peek(tokens, current);
      if (token.kind !== "identifier") throw new Error("Expected type");
      current += 1;
      return namedType(token.text);
    },
    parseBlock: () => {
      const open = peek(tokens, current);
      if (open.text !== "{") throw new Error("Expected block");
      current += 1;
      const close = peek(tokens, current);
      if (close.text !== "}") throw new Error("Expected block close");
      current += 1;
      return block();
    },
  };
}

function identifierExpr(name: Str): CastExpression {
  return { kind: "IdentifierExpr", name, span: sourceSpan };
}

function namedType(name: Str): CastTypeRef {
  return { kind: "NamedTypeRef", name, span: sourceSpan };
}

function block(): CastBlockStmt {
  return { kind: "BlockStmt", statements: [], span: sourceSpan };
}

function peek(tokens: Token[], index: i32): Token {
  return tokens[index] ?? eof();
}

function keyword(text: Str): Token {
  return token("keyword", text);
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

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
