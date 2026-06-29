import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan, offsetAtPosition, spanContainsOffset } from "lsp/source_positions.ts";
import type { b8, i32, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

interface BracePair {
  open: Token;
  close: Token;
}

export function selectionRanges(text: Str, positions: LspPosition[]): JsonValue {
  const tokens = lex(text);
  const pairs = bracePairs(tokens);
  const ranges: JsonRecord[] = [];
  for (const position of positions) {
    const range = selectionRange(text, tokens, pairs, position);
    if (range !== null) ranges.push(range);
  }
  return ranges as unknown as JsonValue;
}

function selectionRange(
  text: Str,
  tokens: Token[],
  pairs: BracePair[],
  position: LspPosition,
): JsonRecord | null {
  const offset = offsetAtPosition(text, position);
  const token = tokenAtOffset(tokens, offset);
  if (token === null) return null;
  return selectionRangeTree(token, enclosingBracePairs(pairs, offset));
}

function tokenAtOffset(tokens: Token[], offset: usize): Token | null {
  for (const token of tokens) {
    if (token.kind === "eof") continue;
    if (spanContainsOffset(token.span, offset)) return token;
  }
  return null;
}

function bracePairs(tokens: Token[]): BracePair[] {
  const pairs: BracePair[] = [];
  const stack: Token[] = [];
  for (const token of tokens) {
    if (token.text === "{") {
      stack.push(token);
      continue;
    }
    if (token.text !== "}") continue;
    const open = stack.pop();
    if (open === undefined) continue;
    pairs.push({ open, close: token });
  }
  return pairs;
}

function enclosingBracePairs(pairs: BracePair[], offset: usize): BracePair[] {
  return pairs
    .filter((pair) => containsOffset(pair, offset))
    .sort(compareInnerFirst);
}

function containsOffset(pair: BracePair, offset: usize): b8 {
  return pair.open.span.start.offset <= offset && offset < pair.close.span.end.offset;
}

function compareInnerFirst(left: BracePair, right: BracePair): i32 {
  return right.open.span.start.offset - left.open.span.start.offset;
}

function selectionRangeTree(token: Token, pairs: BracePair[]): JsonRecord {
  let parent: JsonRecord | undefined;
  for (let index: usize = pairs.length; index > 0; index -= 1) {
    parent = rangeRecord(bracePairRange(pairs[index - 1]!), parent);
  }
  return rangeRecord(tokenRange(token), parent);
}

function rangeRecord(range: JsonValue, parent?: JsonRecord): JsonRecord {
  if (parent === undefined) return { range };
  return { range, parent: parent as unknown as JsonValue };
}

function tokenRange(token: Token): JsonValue {
  return lspRangeFromSpan(token.span) as unknown as JsonValue;
}

function bracePairRange(pair: BracePair): JsonValue {
  return {
    start: {
      line: pair.open.span.start.line - 1,
      character: pair.open.span.start.column - 1,
    },
    end: {
      line: pair.close.span.end.line - 1,
      character: pair.close.span.end.column - 1,
    },
  };
}
