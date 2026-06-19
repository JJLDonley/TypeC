import type { RecordTypeRef, TypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";

type Str = string;

export function lookupRecordAlias(name: TypeName, aliases: Map<Str, TypeRef>): RecordTypeRef | null {
  const type = aliases.get(name);
  if (type?.kind === "RecordTypeRef") return type;
  return null;
}
