import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;

export function arrowFunctionName(span: SourceSpan): Str {
  return `__typec_arrow_${span.start.offset}_${span.end.offset}`;
}
