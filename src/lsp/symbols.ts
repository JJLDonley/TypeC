import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan, offsetAtPosition, spanContainsOffset } from "lsp/source_positions.ts";
import type { b8, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

const TOP_LEVEL_DECLARATIONS = new Set([
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

export interface LspSymbolDefinition {
  name: Str;
  token: Token;
}

export function definitionLocation(text: Str, uri: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  const definition = firstDefinition(symbolDefinitions(tokens), token.text);
  if (definition === null) return null;
  return location(uri, definition.token);
}

export function referenceLocations(
  text: Str,
  uri: Str,
  position: LspPosition,
  includeDeclaration: b8,
): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return [];
  const definition = firstDefinition(symbolDefinitions(tokens), token.text);
  if (definition === null) return [];
  return matchingIdentifierLocations(
    tokens,
    uri,
    token.text,
    definition.token,
    includeDeclaration,
  ) as JsonValue;
}

export function renameWorkspaceEdit(
  text: Str,
  uri: Str,
  position: LspPosition,
  newName: Str,
): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  const definition = firstDefinition(symbolDefinitions(tokens), token.text);
  if (definition === null) return null;
  return workspaceEdit(uri, renameTextEdits(tokens, token.text, newName));
}

export function prepareRenameRange(text: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  const definition = firstDefinition(symbolDefinitions(tokens), token.text);
  if (definition === null) return null;
  return {
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
    placeholder: token.text,
  };
}

export function documentHighlights(text: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return [];
  const definition = firstDefinition(symbolDefinitions(tokens), token.text);
  if (definition === null) return [];
  return matchingIdentifierHighlights(tokens, token.text) as unknown as JsonValue;
}

export function identifierAtPosition(
  tokens: Token[],
  text: Str,
  position: LspPosition,
): Token | null {
  const offset = offsetAtPosition(text, position);
  for (const token of tokens) {
    if (token.kind !== "identifier") continue;
    if (spanContainsOffset(token.span, offset)) return token;
  }
  return null;
}

export function symbolDefinitions(tokens: Token[]): LspSymbolDefinition[] {
  const definitions: LspSymbolDefinition[] = [];
  collectTopLevelDefinitions(tokens, definitions);
  collectFunctionParameterDefinitions(tokens, definitions);
  collectLocalDefinitions(tokens, definitions);
  return definitions;
}

function collectTopLevelDefinitions(tokens: Token[], definitions: LspSymbolDefinition[]): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isTopLevelDeclaration(token)) continue;
    const name = nextIdentifier(tokens, index);
    if (name !== null) definitions.push(symbolDefinition(name));
  }
}

function collectFunctionParameterDefinitions(
  tokens: Token[],
  definitions: LspSymbolDefinition[],
): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isKeyword(tokens[index], "function")) continue;
    const openParen = nextText(tokens, index, "(");
    if (openParen === null) continue;
    collectParameterDefinitions(tokens, openParen + 1, definitions);
  }
}

function collectParameterDefinitions(
  tokens: Token[],
  start: usize,
  definitions: LspSymbolDefinition[],
): void {
  for (let index: usize = start; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.text === ")") return;
    if (token.kind === "identifier" && nextTokenText(tokens, index) === ":") {
      definitions.push(symbolDefinition(token));
    }
  }
}

function collectLocalDefinitions(tokens: Token[], definitions: LspSymbolDefinition[]): void {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isKeyword(tokens[index], "let") && !isKeyword(tokens[index], "const")) continue;
    const name = nextIdentifier(tokens, index);
    if (name !== null) definitions.push(symbolDefinition(name));
  }
}

function firstDefinition(
  definitions: LspSymbolDefinition[],
  name: Str,
): LspSymbolDefinition | null {
  return definitions.find((definition) => definition.name === name) ?? null;
}

function symbolDefinition(token: Token): LspSymbolDefinition {
  return { name: token.text, token };
}

function matchingIdentifierLocations(
  tokens: Token[],
  uri: Str,
  name: Str,
  definition: Token,
  includeDeclaration: b8,
): JsonRecord[] {
  const locations: JsonRecord[] = [];
  for (const token of tokens) {
    if (!isMatchingIdentifier(token, name)) continue;
    if (!includeDeclaration && sameToken(token, definition)) continue;
    locations.push(location(uri, token));
  }
  return locations;
}

function renameTextEdits(tokens: Token[], oldName: Str, newName: Str): JsonRecord[] {
  const edits: JsonRecord[] = [];
  for (const token of tokens) {
    if (!isMatchingIdentifier(token, oldName)) continue;
    edits.push(textEdit(token, newName));
  }
  return edits;
}

function matchingIdentifierHighlights(tokens: Token[], name: Str): JsonRecord[] {
  const highlights: JsonRecord[] = [];
  for (const token of tokens) {
    if (!isMatchingIdentifier(token, name)) continue;
    highlights.push(documentHighlight(token));
  }
  return highlights;
}

function workspaceEdit(uri: Str, edits: JsonRecord[]): JsonRecord {
  return {
    changes: {
      [uri]: edits as unknown as JsonValue,
    },
  };
}

function location(uri: Str, token: Token): JsonRecord {
  return {
    uri,
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
  };
}

function textEdit(token: Token, newText: Str): JsonRecord {
  return {
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
    newText,
  };
}

function documentHighlight(token: Token): JsonRecord {
  return {
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
  };
}

function isMatchingIdentifier(token: Token, name: Str): b8 {
  return token.kind === "identifier" && token.text === name;
}

function sameToken(left: Token, right: Token): b8 {
  return left.span.start.offset === right.span.start.offset &&
    left.span.end.offset === right.span.end.offset;
}

function isTopLevelDeclaration(token: Token): b8 {
  return token.kind === "keyword" && TOP_LEVEL_DECLARATIONS.has(token.text);
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
