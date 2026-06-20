import type { Diagnostic } from "core/diagnostics.ts";
import type { Token } from "core/token.ts";

export function importModifierDiagnostics(
  exportToken: Token | null,
  externToken: Token | null,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (exportToken) {
    diagnostics.push({ message: "Imports cannot be exported", span: exportToken.span });
  }
  if (externToken) {
    diagnostics.push({ message: "Imports cannot be extern", span: externToken.span });
  }
  return diagnostics;
}

export function typeAliasModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{ message: "Type aliases cannot be extern", span: externToken.span }];
}

export function constModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{ message: "Constants cannot be extern", span: externToken.span }];
}

export function functionModifierDiagnostics(
  exportToken: Token | null,
  externToken: Token | null,
): Diagnostic[] {
  if (!exportToken || !externToken) return [];
  return [{ message: "Extern functions cannot be exported", span: externToken.span }];
}
