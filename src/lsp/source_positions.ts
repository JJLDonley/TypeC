import type { SourceSpan } from "core/diagnostics.ts";
import type { b8, JsonRecord, LspPosition, LspRange, Str, usize } from "lsp/types.ts";

export function offsetAtPosition(text: Str, position: LspPosition): usize {
  let line: usize = 0;
  let character: usize = 0;
  let offset: usize = 0;
  while (offset < text.length) {
    if (line === position.line && character === position.character) return offset;
    const ch = text[offset]!;
    offset += 1;
    if (ch === "\n") {
      line += 1;
      character = 0;
    } else {
      character += 1;
    }
  }
  return offset;
}

export function spanContainsOffset(span: SourceSpan, offset: usize): b8 {
  return span.start.offset <= offset && offset < span.end.offset;
}

export function lspRangeFromSpan(span: SourceSpan): LspRange {
  return {
    start: { line: span.start.line - 1, character: span.start.column - 1 },
    end: { line: span.end.line - 1, character: span.end.column - 1 },
  };
}

export function fullDocumentRange(text: Str): JsonRecord {
  const lines = text.split("\n");
  const lastLine = Math.max(0, lines.length - 1);
  return {
    start: { line: 0, character: 0 },
    end: { line: lastLine, character: lines[lastLine]?.length ?? 0 },
  };
}
