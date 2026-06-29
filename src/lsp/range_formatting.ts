import { formatTypeCSource } from "formatter";
import { offsetAtPosition } from "lsp/source_positions.ts";
import type { JsonRecord, JsonValue, LspRange, Str, usize } from "lsp/types.ts";

export function rangeFormattingEdits(text: Str, range: LspRange): JsonValue {
  const offsets = rangeOffsets(text, range);
  if (offsets === null) return [];
  return [rangeFormattingEdit(text, range, offsets)] as unknown as JsonValue;
}

interface TextRangeOffsets {
  start: usize;
  end: usize;
}

function rangeOffsets(text: Str, range: LspRange): TextRangeOffsets | null {
  const start = offsetAtPosition(text, range.start);
  const end = offsetAtPosition(text, range.end);
  if (end <= start) return null;
  return { start, end };
}

function rangeFormattingEdit(
  text: Str,
  range: LspRange,
  offsets: TextRangeOffsets,
): JsonRecord {
  return {
    range: range as unknown as JsonValue,
    newText: formatSelectedText(text, offsets),
  };
}

function formatSelectedText(text: Str, offsets: TextRangeOffsets): Str {
  return formatTypeCSource(text.slice(offsets.start, offsets.end));
}
