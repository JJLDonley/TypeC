import type { SourceSpan, Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";

type Str = string;

export interface IdentifierTypeCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkIdentifierType(name: Str, local: LocalInfo | undefined, span: SourceSpan): IdentifierTypeCheck {
  if (local) return { diagnostics: [], type: local.type };
  return { diagnostics: [{ message: `Unknown identifier '${name}'`, span }], type: "<error>" };
}
