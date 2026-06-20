import type { Diagnostic } from "core/diagnostics.ts";
import type { CastBlockStmt, CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { type DeclarationParser, parseDeclarationWith } from "parser/declarations.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses import declarations", () => {
  const fixture = parserFixture([
    keyword("import"),
    punct("{"),
    identifier("add"),
    punct("}"),
    keyword("from"),
    text("math"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "ImportDecl");
});

Deno.test("parses namespace import declarations", () => {
  const fixture = parserFixture([
    keyword("import"),
    punct("*"),
    keyword("as"),
    identifier("RL"),
    keyword("from"),
    text("raylib"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "ImportDecl");
  if (declaration.kind !== "ImportDecl") throw new Error("Expected import");
  assertText(declaration.namespace ?? "", "RL");
});

Deno.test("parses exported type aliases", () => {
  const fixture = parserFixture([
    keyword("export"),
    keyword("type"),
    identifier("Count"),
    punct("="),
    identifier("i32"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "TypeAliasDecl");
  if (declaration.kind !== "TypeAliasDecl") throw new Error("Expected type alias");
  assertBool(declaration.exported, true);
});

Deno.test("parses module constant declarations", () => {
  const fixture = parserFixture([
    keyword("export"),
    keyword("const"),
    identifier("WIDTH"),
    punct(":"),
    identifier("i32"),
    punct("="),
    integer("800"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "ConstDecl");
  if (declaration.kind !== "ConstDecl") throw new Error("Expected constant");
  assertBool(declaration.exported, true);
});

Deno.test("parses extern function declarations", () => {
  const fixture = parserFixture([
    keyword("extern"),
    keyword("function"),
    identifier("puts"),
    punct("("),
    identifier("text"),
    punct(":"),
    identifier("u8"),
    punct("*"),
    punct(")"),
    punct(":"),
    identifier("i32"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "FunctionDecl");
  if (declaration.kind !== "FunctionDecl") throw new Error("Expected function");
  assertBool(declaration.external, true);
});

Deno.test("parses variadic extern function declarations", () => {
  const fixture = parserFixture([
    keyword("extern"),
    keyword("function"),
    identifier("printf"),
    punct("("),
    identifier("format"),
    punct(":"),
    identifier("u8"),
    punct("*"),
    punct(","),
    operator("..."),
    identifier("args"),
    punct(")"),
    punct(":"),
    identifier("c_int"),
    punct(";"),
  ]);

  const declaration = parseDeclarationWith(fixture.parser);

  assertText(declaration.kind, "FunctionDecl");
  if (declaration.kind !== "FunctionDecl") throw new Error("Expected function");
  assertBool(declaration.variadic === true, true);
});

Deno.test("rejects invalid declaration modifiers", () => {
  const fixture = parserFixture([
    keyword("extern"),
    keyword("import"),
    punct("{"),
    identifier("add"),
    punct("}"),
    keyword("from"),
    text("math"),
    punct(";"),
  ]);

  parseDeclarationWith(fixture.parser);

  assertText(fixture.diagnostics[0]?.message ?? "", "Imports cannot be extern");
});

interface ParserFixture {
  diagnostics: Diagnostic[];
  parser: DeclarationParser;
}

function parserFixture(tokens: Token[]): ParserFixture {
  let current: i32 = 0;
  const diagnostics: Diagnostic[] = [];
  const parser: DeclarationParser = {
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
  return { diagnostics, parser };
}

function parseTypeRef(tokens: Token[], current: i32, setCurrent: (next: i32) => void): CastTypeRef {
  const name = peek(tokens, current);
  if (name.kind !== "identifier") throw new Error("Expected type");
  let next = current + 1;
  let type: CastTypeRef = { kind: "NamedTypeRef", name: name.text, span: sourceSpan };
  if (peek(tokens, next).text === "*") {
    next += 1;
    type = { kind: "PointerTypeRef", element: type, span: sourceSpan };
  }
  setCurrent(next);
  return type;
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

function integer(value: Str): Token {
  return token("integer", value);
}

function text(value: Str): Token {
  return token("string", value);
}

function operator(value: Str): Token {
  return token("operator", value);
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

function assertBool(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
