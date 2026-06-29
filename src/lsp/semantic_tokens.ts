import { lex } from "core/lexer.ts";
import { primitiveTypes, type Token } from "core/token.ts";
import type { b8, i32, JsonRecord, JsonValue, Str } from "lsp/types.ts";

export const semanticTokenTypes: Str[] = [
  "keyword",
  "type",
  "function",
  "variable",
  "property",
  "string",
  "number",
  "operator",
];

export const semanticTokenModifiers: Str[] = [];

interface SemanticTokenEntry {
  line: i32;
  character: i32;
  length: i32;
  typeIndex: i32;
}

export function semanticTokensFull(text: Str): JsonRecord {
  return { data: semanticTokenData(text) as unknown as JsonValue };
}

function semanticTokenData(text: Str): i32[] {
  return encodeSemanticTokens(semanticTokenEntries(lex(text)));
}

function semanticTokenEntries(tokens: Token[]): SemanticTokenEntry[] {
  const entries: SemanticTokenEntry[] = [];
  for (let index: i32 = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const typeIndex = tokenTypeIndex(tokens, index);
    if (typeIndex === null) continue;
    entries.push(semanticTokenEntry(token, typeIndex));
  }
  return entries;
}

function semanticTokenEntry(token: Token, typeIndex: i32): SemanticTokenEntry {
  return {
    line: token.span.start.line - 1,
    character: token.span.start.column - 1,
    length: token.text.length,
    typeIndex,
  };
}

function encodeSemanticTokens(entries: SemanticTokenEntry[]): i32[] {
  const data: i32[] = [];
  let previousLine: i32 = 0;
  let previousCharacter: i32 = 0;
  for (const entry of entries) {
    data.push(lineDelta(entry, previousLine));
    data.push(characterDelta(entry, previousLine, previousCharacter));
    data.push(entry.length);
    data.push(entry.typeIndex);
    data.push(0);
    previousLine = entry.line;
    previousCharacter = entry.character;
  }
  return data;
}

function lineDelta(entry: SemanticTokenEntry, previousLine: i32): i32 {
  return entry.line - previousLine;
}

function characterDelta(entry: SemanticTokenEntry, previousLine: i32, previousCharacter: i32): i32 {
  if (entry.line === previousLine) return entry.character - previousCharacter;
  return entry.character;
}

function tokenTypeIndex(tokens: Token[], index: i32): i32 | null {
  const token = tokens[index]!;
  if (token.kind === "keyword") return tokenType("keyword");
  if (token.kind === "string") return tokenType("string");
  if (token.kind === "integer" || token.kind === "float") return tokenType("number");
  if (token.kind === "operator" || operatorPunctuation(token.text)) return tokenType("operator");
  if (token.kind !== "identifier") return null;
  return identifierTypeIndex(tokens, index);
}

function identifierTypeIndex(tokens: Token[], index: i32): i32 {
  const token = tokens[index]!;
  if (primitiveTypes.has(token.text)) return tokenType("type");
  if (previousText(tokens, index) === ".") return tokenType("property");
  if (nextText(tokens, index) === "(") return tokenType("function");
  if (declarationTypeKeyword(previousText(tokens, index))) return tokenType("type");
  return tokenType("variable");
}

function tokenType(name: Str): i32 {
  const index = semanticTokenTypes.indexOf(name);
  if (index < 0) throw new Error(`Unknown semantic token type ${name}`);
  return index;
}

function previousText(tokens: Token[], index: i32): Str | null {
  return tokens[index - 1]?.text ?? null;
}

function nextText(tokens: Token[], index: i32): Str | null {
  return tokens[index + 1]?.text ?? null;
}

function declarationTypeKeyword(text: Str | null): b8 {
  return text === "type" || text === "struct" || text === "class" || text === "interface" ||
    text === "enum" || text === "union";
}

function operatorPunctuation(text: Str): b8 {
  return text === ":" || text === ";" || text === "," || text === ".";
}
