import { renderDiagnostic } from "core/diagnostic_rendering.ts";

type Str = string;
type usize = number;

export type DiagnosticCode = Str;

export interface SourcePos {
  offset: usize;
  line: usize;
  column: usize;
}

export interface SourceSpan {
  start: SourcePos;
  end: SourcePos;
}

export interface RelatedDiagnostic {
  message: Str;
  span: SourceSpan;
}

export interface Diagnostic {
  message: Str;
  code?: DiagnosticCode;
  span?: SourceSpan;
  severity?: "error" | "warning" | "note" | "help";
  related?: RelatedDiagnostic[];
  notes?: Str[];
  help?: Str;
}

export class TypeCError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join("\n"));
  }
}

export function formatDiagnostic(fileName: Str, source: Str, diagnostic: Diagnostic): Str {
  return renderDiagnostic(fileName, source, diagnostic);
}
