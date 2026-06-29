import { diagnosticCodeUrl } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { check } from "checker";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { resolve } from "core/resolver.ts";
import { parse } from "parser";
import { loadProgramWithEntryTextSync } from "module/loader_sync.ts";
import { loadProjectConfigSync } from "project/config.ts";
import type { b8, LspDiagnostic, LspRange, Str } from "lsp/types.ts";

const ERROR_SEVERITY = 1;

export function syntaxDiagnostics(text: Str, uri: Str = "file:///main.tc"): LspDiagnostic[] {
  try {
    parse(lex(text));
    return [];
  } catch (error) {
    if (error instanceof TypeCError) {
      return error.diagnostics.map((item) => toLspDiagnostic(item, uri));
    }
    throw error;
  }
}

export function semanticDiagnostics(text: Str, uri: Str = "file:///main.tc"): LspDiagnostic[] {
  try {
    check(resolve(instantiateGenerics(programForDiagnostics(text, uri))));
    return [];
  } catch (error) {
    if (error instanceof TypeCError) {
      return error.diagnostics.map((item) => toLspDiagnostic(item, uri));
    }
    throw error;
  }
}

function programForDiagnostics(text: Str, uri: Str): ReturnType<typeof parse> {
  const path = fileUriPath(uri);
  if (path === null || !fileExists(path)) return parse(lex(text));
  return loadProgramWithEntryTextSync(path, text, loadProjectConfigSync(path));
}

function fileExists(path: Str): b8 {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

function fileUriPath(uri: Str): Str | null {
  try {
    const url = new URL(uri);
    if (url.protocol !== "file:") return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function toLspDiagnostic(diagnostic: Diagnostic, uri: Str): LspDiagnostic {
  return {
    range: diagnostic.span ? toRange(diagnostic.span) : emptyRange(),
    severity: ERROR_SEVERITY,
    source: "typec",
    message: diagnostic.message,
    code: diagnostic.code,
    relatedInformation: (diagnostic.related ?? []).map((related) => ({
      location: { uri, range: toRange(related.span) },
      message: related.message,
    })),
    codeDescription: { href: diagnosticCodeUrl(diagnostic.code) },
  };
}

function toRange(span: NonNullable<Diagnostic["span"]>): LspRange {
  return {
    start: {
      line: Math.max(0, span.start.line - 1),
      character: Math.max(0, span.start.column - 1),
    },
    end: {
      line: Math.max(0, span.end.line - 1),
      character: Math.max(0, span.end.column - 1),
    },
  };
}

function emptyRange(): LspRange {
  return { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } };
}
