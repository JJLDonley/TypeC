import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import type { JsonRecord, JsonValue, Str, usize } from "lsp/types.ts";

export function foldingRanges(text: Str): JsonValue {
  return braceFoldingRanges(lex(text)) as unknown as JsonValue;
}

function braceFoldingRanges(tokens: Token[]): JsonRecord[] {
  const ranges: JsonRecord[] = [];
  const stack: Token[] = [];
  for (const token of tokens) {
    if (token.text === "{") {
      stack.push(token);
      continue;
    }
    if (token.text !== "}") continue;
    const open = stack.pop();
    if (open === undefined) continue;
    appendBraceRange(ranges, open, token);
  }
  return ranges;
}

function appendBraceRange(ranges: JsonRecord[], open: Token, close: Token): void {
  const startLine = lspLine(open);
  const endLine = lspLine(close);
  if (startLine >= endLine) return;
  ranges.push({
    startLine,
    endLine,
    kind: "region",
  });
}

function lspLine(token: Token): usize {
  return token.span.start.line - 1;
}
