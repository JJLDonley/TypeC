import { check } from "checker";
import { TypeCError } from "core/diagnostics.ts";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { resolve } from "core/resolver.ts";
import { parse } from "parser";
import { formatTypeCSource } from "formatter";
import { fullDocumentRange } from "lsp/source_positions.ts";
import type { b8, JsonValue, Str } from "lsp/types.ts";

export function documentFormattingEdits(text: Str): JsonValue {
  if (!isAcceptedByCompiler(text)) return [];
  return [{
    range: fullDocumentRange(text),
    newText: formatTypeCSource(text),
  }] as unknown as JsonValue;
}

function isAcceptedByCompiler(text: Str): b8 {
  try {
    check(resolve(instantiateGenerics(parse(lex(text)))));
    return true;
  } catch (error) {
    if (error instanceof TypeCError) return false;
    throw error;
  }
}
