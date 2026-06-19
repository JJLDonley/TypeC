export interface SourcePos {
  offset: number;
  line: number;
  column: number;
}

export interface SourceSpan {
  start: SourcePos;
  end: SourcePos;
}

export interface Diagnostic {
  message: string;
  span?: SourceSpan;
}

export class TypeCError extends Error {
  constructor(public diagnostics: Diagnostic[]) {
    super(diagnostics.map((d) => d.message).join("\n"));
  }
}

export function formatDiagnostic(fileName: string, source: string, diagnostic: Diagnostic): string {
  if (!diagnostic.span) return `${fileName}: ${diagnostic.message}`;

  const { line, column } = diagnostic.span.start;
  const lineText = source.split(/\r?\n/)[line - 1] ?? "";
  const pointer = `${" ".repeat(Math.max(0, column - 1))}^`;
  return `${fileName}:${line}:${column}: ${diagnostic.message}\n${lineText}\n${pointer}`;
}
