import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import type { LspDiagnostic, Str } from "lsp/types.ts";

const ERROR_SEVERITY = 1;

export function syntaxDiagnostics(text: Str): LspDiagnostic[] {
  try {
    parse(lex(text));
    return [];
  } catch (error) {
    if (error instanceof TypeCError) return error.diagnostics.map(toLspDiagnostic);
    throw error;
  }
}

function toLspDiagnostic(diagnostic: Diagnostic): LspDiagnostic {
  return {
    range: diagnostic.span
      ? {
        start: {
          line: Math.max(0, diagnostic.span.start.line - 1),
          character: Math.max(0, diagnostic.span.start.column - 1),
        },
        end: {
          line: Math.max(0, diagnostic.span.end.line - 1),
          character: Math.max(0, diagnostic.span.end.column - 1),
        },
      }
      : { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    severity: ERROR_SEVERITY,
    source: "typec",
    message: diagnostic.message,
  };
}
