import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import { identifierAtPosition, symbolDefinitions } from "lsp/symbols.ts";
import type { b8, JsonRecord, JsonValue, LspPosition, Str } from "lsp/types.ts";

const IDENTIFIER_WORD_PATTERN = "[A-Za-z_][A-Za-z0-9_]*";

export function linkedEditingRanges(text: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  if (!hasDefinition(tokens, token.text)) return null;
  return linkedEditingRecord(tokens, token.text);
}

function linkedEditingRecord(tokens: Token[], name: Str): JsonRecord {
  return {
    ranges: matchingIdentifierRanges(tokens, name) as unknown as JsonValue,
    wordPattern: IDENTIFIER_WORD_PATTERN,
  };
}

function matchingIdentifierRanges(tokens: Token[], name: Str): JsonValue[] {
  const ranges: JsonValue[] = [];
  for (const token of tokens) {
    if (!isMatchingIdentifier(token, name)) continue;
    ranges.push(lspRangeFromSpan(token.span) as unknown as JsonValue);
  }
  return ranges;
}

function hasDefinition(tokens: Token[], name: Str): b8 {
  return symbolDefinitions(tokens).some((definition) => definition.name === name);
}

function isMatchingIdentifier(token: Token, name: Str): b8 {
  return token.kind === "identifier" && token.text === name;
}
