import type { JsonRecord, JsonValue, Str } from "lsp/types.ts";

const KEYWORDS: Str[] = [
  "const",
  "else",
  "enum",
  "export",
  "function",
  "if",
  "import",
  "return",
  "struct",
  "type",
  "union",
  "while",
];

export function completionItems(): JsonValue {
  return KEYWORDS.map(keywordCompletion) as JsonValue;
}

function keywordCompletion(keyword: Str): JsonRecord {
  return {
    label: keyword,
    kind: 14,
  };
}
