import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import type { b8, JsonRecord, JsonValue, Str, usize } from "lsp/types.ts";

export function documentLinks(text: Str, uri: Str): JsonValue {
  return importDocumentLinks(lex(text), uri) as unknown as JsonValue;
}

function importDocumentLinks(tokens: Token[], uri: Str): JsonRecord[] {
  const links: JsonRecord[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (!isImportPathToken(tokens, index)) continue;
    links.push(documentLink(token, targetUri(token.text, uri)));
  }
  return links;
}

function documentLink(token: Token, target: Str | null): JsonRecord {
  const link: JsonRecord = {
    range: lspRangeFromSpan(token.span) as unknown as JsonValue,
  };
  if (target !== null) link.target = target;
  return link;
}

function targetUri(path: Str, uri: Str): Str | null {
  if (!isRelativeImport(path)) return path;
  try {
    return new URL(path, uri).href;
  } catch {
    return null;
  }
}

function isImportPathToken(tokens: Token[], index: usize): b8 {
  const token = tokens[index]!;
  if (token.kind !== "string") return false;
  return previousImportPathMarker(tokens, index) !== null;
}

function previousImportPathMarker(tokens: Token[], index: usize): Token | null {
  for (let current: usize = index; current > 0; current -= 1) {
    const token = tokens[current - 1]!;
    if (token.text === ";" || token.text === "{") return null;
    if (token.text === "from" || token.text === "import") return token;
  }
  return null;
}

function isRelativeImport(path: Str): b8 {
  return path.startsWith("./") || path.startsWith("../");
}
