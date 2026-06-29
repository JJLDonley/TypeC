import { definitionLocation } from "lsp/symbols.ts";
import type { JsonValue, LspPosition, Str } from "lsp/types.ts";

export function declarationLocation(text: Str, uri: Str, position: LspPosition): JsonValue {
  return definitionLocation(text, uri, position);
}
