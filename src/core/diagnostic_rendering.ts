import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";

type Str = string;
type usize = number;

export function renderDiagnostic(fileName: Str, source: Str, diagnostic: Diagnostic): Str {
  const severity = diagnostic.severity ?? "error";
  const heading = diagnostic.code === undefined
    ? `${severity}: ${diagnostic.message}`
    : `${severity}[${diagnostic.code}]: ${diagnostic.message}`;
  const lines = [heading];
  if (diagnostic.span) lines.push(...renderSpan(fileName, source, diagnostic.span, ""));
  for (const related of diagnostic.related ?? []) {
    lines.push(`note: ${related.message}`);
    lines.push(...renderSpan(fileName, source, related.span, ""));
  }
  for (const note of diagnostic.notes ?? []) lines.push(`note: ${note}`);
  if (diagnostic.help) lines.push(`help: ${diagnostic.help}`);
  return lines.join("\n");
}

function renderSpan(fileName: Str, source: Str, span: SourceSpan, label: Str): Str[] {
  const lineNumber = span.start.line;
  const lineText = sourceLine(source, lineNumber);
  const gutter = lineNumber.toString();
  return [
    ` --> ${fileName}:${span.start.line}:${span.start.column}`,
    `${" ".repeat(gutter.length)} |`,
    `${gutter} | ${lineText}`,
    `${" ".repeat(gutter.length)} | ${caretLine(span, label)}`,
  ];
}

function sourceLine(source: Str, line: usize): Str {
  return source.split(/\r?\n/)[line - 1] ?? "";
}

function caretLine(span: SourceSpan, label: Str): Str {
  const width = Math.max(1, span.end.offset - span.start.offset);
  const carets = "^".repeat(width);
  const suffix = label.length === 0 ? "" : ` ${label}`;
  return `${" ".repeat(Math.max(0, span.start.column - 1))}${carets}${suffix}`;
}
