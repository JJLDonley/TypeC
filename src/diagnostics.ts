type Str = string;
type usize = number;

export interface SourcePos {
  offset: usize;
  line: usize;
  column: usize;
}

export interface SourceSpan {
  start: SourcePos;
  end: SourcePos;
}

export interface Diagnostic {
  message: Str;
  span?: SourceSpan;
}

export class TypeCError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join("\n"));
  }
}

export function formatDiagnostic(fileName: Str, source: Str, diagnostic: Diagnostic): Str {
  if (!diagnostic.span) return `${fileName}: ${diagnostic.message}`;

  const { line, column } = diagnostic.span.start;
  const lineText = source.split(/\r?\n/)[line - 1] ?? "";
  const pointer = `${" ".repeat(Math.max(0, column - 1))}^`;
  return `${fileName}:${line}:${column}: ${diagnostic.message}\n${lineText}\n${pointer}`;
}
