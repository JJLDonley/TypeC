import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import type { b8, i32, JsonRecord, JsonValue, Str, usize } from "lsp/types.ts";

const SYMBOL_NAMESPACE: i32 = 3;
const SYMBOL_CLASS: i32 = 5;
const SYMBOL_ENUM: i32 = 10;
const SYMBOL_INTERFACE: i32 = 11;
const SYMBOL_FUNCTION: i32 = 12;
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

export function workspaceSymbols(documents: [Str, Str][], query: Str): JsonValue {
  const symbols: JsonRecord[] = [];
  for (const [uri, text] of documents) {
    collectDocumentSymbols(symbols, uri, text, query);
  }
  return symbols as unknown as JsonValue;
}

function collectDocumentSymbols(
  symbols: JsonRecord[],
  uri: Str,
  text: Str,
  query: Str,
): void {
  const tokens = lex(text);
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const keyword = tokens[index]!;
    if (!isDeclarationKeyword(keyword)) continue;
    const name = nextIdentifier(tokens, index);
    if (name === null || !matchesQuery(name.text, query)) continue;
    symbols.push(symbolInformation(uri, name, symbolKind(keyword.text)));
  }
}

function symbolInformation(uri: Str, token: Token, kind: i32): JsonRecord {
  return {
    name: token.text,
    kind,
    location: {
      uri,
      range: lspRangeFromSpan(token.span) as unknown as JsonValue,
    },
  };
}

function symbolKind(keyword: Str): i32 {
  if (keyword === "function") return SYMBOL_FUNCTION;
  if (keyword === "class") return SYMBOL_CLASS;
  if (keyword === "interface") return SYMBOL_INTERFACE;
  if (keyword === "enum") return SYMBOL_ENUM;
  if (keyword === "namespace") return SYMBOL_NAMESPACE;
  if (keyword === "const") return SYMBOL_CONSTANT;
  return SYMBOL_STRUCT;
}

function matchesQuery(name: Str, query: Str): b8 {
  return query === "" || name.includes(query);
}

function isDeclarationKeyword(token: Token): b8 {
  return token.kind === "keyword" && DECLARATION_KEYWORDS.has(token.text);
}

function nextIdentifier(tokens: Token[], index: usize): Token | null {
  const token = tokens[index + 1];
  if (token === undefined || token.kind !== "identifier") return null;
  return token;
}
