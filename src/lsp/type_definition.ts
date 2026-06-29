import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import { identifierAtPosition } from "lsp/symbols.ts";
import type { b8, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

const TYPE_DECLARATIONS = new Set(["type", "struct", "class", "interface", "enum", "union"]);

interface TypeDefinition {
  name: Str;
  token: Token;
}

export function typeDefinitionLocation(text: Str, uri: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  const definition = firstTypeDefinition(typeDefinitions(tokens), token.text);
  if (definition === null) return null;
  return location(uri, definition.token);
}

function typeDefinitions(tokens: Token[]): TypeDefinition[] {
  const definitions: TypeDefinition[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isTypeDeclaration(tokens[index])) continue;
    const name = tokens[index + 1];
    if (name?.kind === "identifier") definitions.push({ name: name.text, token: name });
  }
  return definitions;
}

function firstTypeDefinition(definitions: TypeDefinition[], name: Str): TypeDefinition | null {
  return definitions.find((definition) => definition.name === name) ?? null;
}

function location(uri: Str, token: Token): JsonRecord {
  return {
    uri,
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
  };
}

function isTypeDeclaration(token: Token | undefined): b8 {
  return token !== undefined && token.kind === "keyword" && TYPE_DECLARATIONS.has(token.text);
}
