import type { RecordTypeRef } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function expectedRecordType(expectedType: Str, context: EmitContext): RecordTypeRef | null {
  const direct = context.typeAliases.get(expectedType)?.type;
  if (direct?.kind === "RecordTypeRef") return direct;
  return cNamedRecordType(expectedType, context);
}

function cNamedRecordType(expectedType: Str, context: EmitContext): RecordTypeRef | null {
  for (const typeAlias of context.typeAliases.values()) {
    if (typeAliasCName(typeAlias.name, typeAlias.cName) !== expectedType) continue;
    if (typeAlias.type.kind === "RecordTypeRef") return typeAlias.type;
  }
  return null;
}

function typeAliasCName(name: Str, cName: Str | null | undefined): Str {
  return cName ?? name;
}
