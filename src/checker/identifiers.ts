import type { ConstDecl } from "core/ast.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export interface IdentifierTypeCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkIdentifierType(
  name: Str,
  local: LocalInfo | undefined,
  constant: ConstDecl | undefined,
  span: SourceSpan,
): IdentifierTypeCheck {
  if (local) return { diagnostics: [], type: local.type };
  if (constant) return { diagnostics: [], type: typeName(constant.type) };
  return { diagnostics: [{ message: `Unknown identifier '${name}'`, span }], type: "<error>" };
}
