import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import type { b8, i32, JsonRecord, JsonValue, Str, usize } from "lsp/types.ts";

const SYMBOL_NAMESPACE: i32 = 3;
const SYMBOL_CLASS: i32 = 5;
const SYMBOL_ENUM: i32 = 10;
const SYMBOL_INTERFACE: i32 = 11;
const SYMBOL_FUNCTION: i32 = 12;
const SYMBOL_VARIABLE: i32 = 13;
const SYMBOL_CONSTANT: i32 = 14;
const SYMBOL_STRUCT: i32 = 23;

const DECLARATION_KEYWORDS = new Set([
  "function",
  "type",
  "struct",
  "class",
  "interface",
  "enum",
  "union",
  "namespace",
  "const",
]);

export function documentSymbols(text: Str): JsonValue {
  return symbolRecords(lex(text)) as unknown as JsonValue;
}

function symbolRecords(tokens: Token[]): JsonRecord[] {
  const symbols: JsonRecord[] = [];
  collectDeclarationSymbols(tokens, symbols);
  collectParameterSymbols(tokens, symbols);
  collectLocalSymbols(tokens, symbols);
  return symbols;
}

function collectDeclarationSymbols(tokens: Token[], symbols: JsonRecord[]): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isDeclarationKeyword(token)) continue;
    const name = nextIdentifier(tokens, index);
    if (name === null) continue;
    symbols.push(symbolRecord(name, symbolKind(token.text)));
  }
}

function collectParameterSymbols(tokens: Token[], symbols: JsonRecord[]): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isKeyword(tokens[index], "function")) continue;
    const openParen = nextText(tokens, index, "(");
    if (openParen === null) continue;
    collectParameters(tokens, openParen + 1, symbols);
  }
}

function collectParameters(tokens: Token[], start: usize, symbols: JsonRecord[]): void {
  for (let index: usize = start; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.text === ")") return;
    if (token.kind === "identifier" && nextTokenText(tokens, index) === ":") {
      symbols.push(symbolRecord(token, SYMBOL_VARIABLE));
    }
  }
}

function collectLocalSymbols(tokens: Token[], symbols: JsonRecord[]): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isKeyword(token, "let") && !isKeyword(token, "const")) continue;
    const name = nextIdentifier(tokens, index);
    if (name === null) continue;
    symbols.push(symbolRecord(name, localSymbolKind(token.text)));
  }
}

function symbolRecord(token: Token, kind: i32): JsonRecord {
  const range = lspRangeFromSpan(token.span) as unknown as JsonValue;
  return {
    name: token.text,
    kind,
    range,
    selectionRange: range,
  };
}

function symbolKind(keyword: Str): i32 {
  if (keyword === "function") return SYMBOL_FUNCTION;
  if (keyword === "class") return SYMBOL_CLASS;
  if (keyword === "interface") return SYMBOL_INTERFACE;
  if (keyword === "enum") return SYMBOL_ENUM;
  if (keyword === "namespace") return SYMBOL_NAMESPACE;
  if (keyword === "struct") return SYMBOL_STRUCT;
  if (keyword === "const") return SYMBOL_CONSTANT;
  return SYMBOL_STRUCT;
}

function localSymbolKind(keyword: Str): i32 {
  if (keyword === "const") return SYMBOL_CONSTANT;
  return SYMBOL_VARIABLE;
}

function isDeclarationKeyword(token: Token): b8 {
  return token.kind === "keyword" && DECLARATION_KEYWORDS.has(token.text);
}

function isKeyword(token: Token | undefined, text: Str): b8 {
  return token !== undefined && token.kind === "keyword" && token.text === text;
}

function nextIdentifier(tokens: Token[], index: usize): Token | null {
  const token = tokens[index + 1];
  if (token === undefined || token.kind !== "identifier") return null;
  return token;
}

function nextText(tokens: Token[], index: usize, text: Str): usize | null {
  for (let current: usize = index + 1; current < tokens.length; current += 1) {
    if (tokens[current]!.text === text) return current;
  }
  return null;
}

function nextTokenText(tokens: Token[], index: usize): Str | null {
  return tokens[index + 1]?.text ?? null;
}
