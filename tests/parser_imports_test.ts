import type { Diagnostic } from "core/diagnostics.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parseImportNamesWith, type ImportNameParser } from "parser/imports.ts";

type Str = string;
type b8 = boolean;
type i32 = number;
type usize = number;

const span = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses import names", () => {
  const parser = parserFor([identifier("add"), punct(","), identifier("sub"), punct("}")]);

  const names = parseImportNamesWith(parser);

  assertText(names.join(","), "add,sub");
  assertLen(parser.diagnostics.length, 0);
});

Deno.test("reports duplicate and empty import names", () => {
  const duplicate = parserFor([identifier("add"), punct(","), identifier("add"), punct("}")]);
  const empty = parserFor([punct("}")]);

  parseImportNamesWith(duplicate);
  parseImportNamesWith(empty);

  assertText(duplicate.diagnostics[0]?.message ?? "", "Duplicate imported name 'add'");
  assertText(empty.diagnostics[0]?.message ?? "", "Import must name at least one symbol");
});

interface TestImportNameParser extends ImportNameParser {
  diagnostics: Diagnostic[];
}

function parserFor(tokens: Token[]): TestImportNameParser {
  let current: i32 = 0;
  const diagnostics: Diagnostic[] = [];
  return {
    diagnostics,
    checkText: (text) => tokens[current]?.text === text,
    matchText: (text) => {
      if (tokens[current]?.text !== text) return false;
      current += 1;
      return true;
    },
    expectKind: (kind, message) => {
      const token = tokens[current] ?? eof();
      if (token.kind !== kind) {
        diagnostics.push({ message, span: token.span });
        throw new Error(message);
      }
      current += 1;
      return token;
    },
    peek: () => tokens[current] ?? eof(),
    error: (token, message) => diagnostics.push({ message, span: token.span }),
  };
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
  return { kind, text, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertLen(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
