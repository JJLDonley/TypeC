import {
  PARSE_CLASS_EXTERN,
  PARSE_CONSTANT_EXTERN,
  PARSE_ENUM_EXTERN,
  PARSE_IMPORT_EXPORTED,
  PARSE_IMPORT_EXTERN,
  PARSE_INTERFACE_EXTERN,
  PARSE_TYPE_ALIAS_EXTERN,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { Token } from "core/token.ts";

export function importModifierDiagnostics(
  exportToken: Token | null,
  externToken: Token | null,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (exportToken) {
    diagnostics.push({
      message: "Imports cannot be exported",
      code: PARSE_IMPORT_EXPORTED,
      span: exportToken.span,
    });
  }
  if (externToken) {
    diagnostics.push({
      message: "Imports cannot be extern",
      code: PARSE_IMPORT_EXTERN,
      span: externToken.span,
    });
  }
  return diagnostics;
}

export function typeAliasModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{
    message: "Type aliases cannot be extern",
    code: PARSE_TYPE_ALIAS_EXTERN,
    span: externToken.span,
  }];
}

export function constModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{
    message: "Constants cannot be extern",
    code: PARSE_CONSTANT_EXTERN,
    span: externToken.span,
  }];
}

export function enumModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{
    message: "Enums cannot be extern",
    code: PARSE_ENUM_EXTERN,
    span: externToken.span,
  }];
}

export function classModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{
    message: "Classes cannot be extern",
    code: PARSE_CLASS_EXTERN,
    span: externToken.span,
  }];
}

export function interfaceModifierDiagnostics(externToken: Token | null): Diagnostic[] {
  if (!externToken) return [];
  return [{
    message: "Interfaces cannot be extern",
    code: PARSE_INTERFACE_EXTERN,
    span: externToken.span,
  }];
}

export function functionModifierDiagnostics(
  _exportToken: Token | null,
  _externToken: Token | null,
): Diagnostic[] {
  return [];
}
