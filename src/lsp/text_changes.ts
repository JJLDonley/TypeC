import { offsetAtPosition } from "lsp/source_positions.ts";
import type { JsonRecord, JsonValue, LspRange, Str } from "lsp/types.ts";

export function applyTextDocumentChange(current: Str | null, change: JsonRecord): Str {
  const text = textField(change);
  const range = optionalRange(change.range);
  if (range === null) return text;
  return applyRangeChange(current ?? "", range, text);
}

function applyRangeChange(current: Str, range: LspRange, text: Str): Str {
  const start = offsetAtPosition(current, range.start);
  const end = offsetAtPosition(current, range.end);
  return `${current.slice(0, start)}${text}${current.slice(end)}`;
}

function textField(record: JsonRecord): Str {
  const value = record.text;
  if (typeof value !== "string") throw new Error("Expected text change text");
  return value;
}

function optionalRange(value: JsonValue | undefined): LspRange | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value) || typeof value !== "object") throw new Error("Expected change range");
  return value as unknown as LspRange;
}
