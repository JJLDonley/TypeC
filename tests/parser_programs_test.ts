import type { Diagnostic } from "core/diagnostics.ts";
import type { CastBlockStmt, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parseProgramWith, type ProgramParser } from "parser/programs.ts";
import type { DeclarationParser } from "parser/declarations.ts";

type Str = string;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses program declarations", () => {
  const fixture = parserFixture([
    keyword("import"),
    punct("{"),
    identifier("add"),
    punct("}"),
    keyword("from"),
    text("math"),
    punct(";"),
    keyword("type"),
    identifier("Count"),
    punct("="),
    identifier("i32"),
    punct(";"),
    keyword("function"),
    identifier("main"),
    punct("("),
    punct(")"),
    punct(":"),
    identifier("i32"),
    punct("{"),
    punct("}"),
    eof(),
  ]);

  const program = parseProgramWith(fixture.parser);

  assertCount(program.imports.length, 1);
  assertCount(program.typeAliases.length, 1);
  assertCount(program.functions.length, 1);
});

Deno.test("throws after declaration diagnostics", () => {
  const fixture = parserFixture([
    keyword("extern"),
    keyword("type"),
    identifier("Bad"),
    punct("="),
    identifier("i32"),
    punct(";"),
    eof(),
  ]);

  try {
    parseProgramWith(fixture.parser);
  } catch (_error) {
    assertText(fixture.diagnostics[0]?.message ?? "", "Type aliases cannot be extern");
    return;
  }
  throw new Error("Expected parse error");
});

interface ParserFixture {
  diagnostics: Diagnostic[];
  parser: ProgramParser;
}

function parserFixture(tokens: Token[]): ParserFixture {
  let current: i32 = 0;
  const diagnostics: Diagnostic[] = [];
  const declarationParser: DeclarationParser = {
    diagnostics: () => diagnostics,
    checkText: (value) => peek(tokens, current).text === value,
    matchText: (value) => {
      if (peek(tokens, current).text !== value) return false;
      current += 1;
      return true;
    },
    previous: () => peek(tokens, current - 1),
    expectKind: (kind, message) => {
      const token = peek(tokens, current);
      if (token.kind !== kind) throw new Error(message);
      current += 1;
      return token;
    },
    expectText: (value) => {
      const token = peek(tokens, current);
      if (token.text !== value) throw new Error(`Expected '${value}'`);
      current += 1;
      return token;
    },
    peek: () => peek(tokens, current),
    error: (token, message) => diagnostics.push({ message, span: token.span }),
    parseTypeRef: () => parseTypeRef(tokens, current, (next) => current = next),
    parseExpression: () => parseExpression(tokens, current, (next) => current = next),
    parseBlock: () => parseBlock(tokens, current, (next) => current = next),
  };
  return {
    diagnostics,
    parser: {
      diagnostics: () => diagnostics,
      peek: () => peek(tokens, current),
      checkEof: () => peek(tokens, current).kind === "eof",
      declarationParser: () => declarationParser,
    },
  };
}

function parseTypeRef(tokens: Token[], current: i32, setCurrent: (next: i32) => void): CastTypeRef {
  const token = peek(tokens, current);
  if (token.kind !== "identifier") throw new Error("Expected type");
  setCurrent(current + 1);
  return { kind: "NamedTypeRef", name: token.text, span: sourceSpan };
}

function parseExpression(tokens: Token[], current: i32, setCurrent: (next: i32) => void) {
  const token = peek(tokens, current);
  setCurrent(current + 1);
  return {
    kind: "IntegerLiteral" as const,
    value: BigInt(token.text),
    text: token.text,
    span: sourceSpan,
  };
}

function parseBlock(tokens: Token[], current: i32, setCurrent: (next: i32) => void): CastBlockStmt {
  if (peek(tokens, current).text !== "{") throw new Error("Expected block");
  if (peek(tokens, current + 1).text !== "}") throw new Error("Expected block close");
  setCurrent(current + 2);
  return { kind: "BlockStmt", statements: [], span: sourceSpan };
}

function peek(tokens: Token[], index: i32): Token {
  return tokens[index] ?? eof();
}

function keyword(value: Str): Token {
  return token("keyword", value);
}

function identifier(value: Str): Token {
  return token("identifier", value);
}

function text(value: Str): Token {
  return token("string", value);
}

function punct(value: Str): Token {
  return token("punctuation", value);
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

function assertCount(actual: i32, expected: i32): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
