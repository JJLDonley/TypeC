import { formatTypeCSource } from "formatter";
import { fullDocumentRange } from "lsp/source_positions.ts";
import type { JsonRecord, JsonValue, Str } from "lsp/types.ts";

export function codeActions(text: Str, uri: Str): JsonValue {
  const formatted = formatTypeCSource(text);
  if (formatted === text) return [];
  return [formatDocumentAction(text, uri, formatted)] as unknown as JsonValue;
}

function formatDocumentAction(text: Str, uri: Str, formatted: Str): JsonRecord {
  return {
    title: "Format document",
    kind: "source.format",
    edit: {
      changes: {
        [uri]: [formatTextEdit(text, formatted)] as unknown as JsonValue,
      },
    },
  };
}

function formatTextEdit(text: Str, formatted: Str): JsonRecord {
  return {
    range: fullDocumentRange(text),
    newText: formatted,
  };
}
