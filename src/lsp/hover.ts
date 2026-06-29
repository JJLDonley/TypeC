import { lex } from "core/lexer.ts";
import { primitiveTypes, type Token } from "core/token.ts";
import { offsetAtPosition, spanContainsOffset } from "lsp/source_positions.ts";
import type { b8, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

interface SymbolHover {
  name: Str;
  text: Str;
}

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

export function hoverContent(text: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = tokenAtPosition(tokens, offsetAtPosition(text, position));
  if (token === null) return null;
  return hoverForToken(token, declarationHovers(tokens));
}

function tokenAtPosition(tokens: Token[], offset: usize): Token | null {
  for (const token of tokens) {
    if (token.kind === "eof") continue;
    if (spanContainsOffset(token.span, offset)) return token;
  }
  return null;
}

function hoverForToken(token: Token, hovers: Map<Str, SymbolHover>): JsonValue {
  const hover = knownHover(token, hovers);
  if (hover === null) return null;
  return hoverResponse(hover.text);
}

function knownHover(token: Token, hovers: Map<Str, SymbolHover>): SymbolHover | null {
  if (token.kind === "keyword") return { name: token.text, text: `keyword ${token.text}` };
  if (primitiveTypes.has(token.text)) {
    return { name: token.text, text: `primitive type ${token.text}` };
  }
  return hovers.get(token.text) ?? null;
}

function declarationHovers(tokens: Token[]): Map<Str, SymbolHover> {
  const hovers = new Map<Str, SymbolHover>();
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isDeclarationKeyword(token)) continue;
    const name = declarationName(tokens, index);
    if (name === null) continue;
    hovers.set(name.text, { name: name.text, text: declarationHoverText(token.text, name.text) });
  }
  return hovers;
}

function isDeclarationKeyword(token: Token): b8 {
  return token.kind === "keyword" && DECLARATION_KEYWORDS.has(token.text);
}

function declarationName(tokens: Token[], keywordIndex: usize): Token | null {
  const next = tokens[keywordIndex + 1];
  if (next === undefined || next.kind !== "identifier") return null;
  return next;
}

function declarationHoverText(kind: Str, name: Str): Str {
  if (kind === "const") return `const ${name}`;
  return `${kind} ${name}`;
}

function hoverResponse(text: Str): JsonRecord {
  return {
    contents: {
      kind: "markdown",
      value: `\`\`\`typec\n${text}\n\`\`\``,
    },
  };
}
