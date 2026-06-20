import type { RecordTypeRef, TypeAliasDecl } from "core/ast.ts";
import { emitCDeclarator } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function emitTypeAlias(typeAlias: TypeAliasDecl, context: EmitContext): Str {
  if (typeAlias.type.kind !== "RecordTypeRef") {
    throw new Error("Only record type aliases can be emitted");
  }
  return emitRecordTypeAlias(typeAlias.cName ?? typeAlias.name, typeAlias.type, context);
}

function emitRecordTypeAlias(name: Str, type: RecordTypeRef, context: EmitContext): Str {
  const out: Str[] = [];
  out.push("typedef struct {");
  for (const field of type.fields) {
    out.push(`  ${emitCDeclarator(field.type, field.name, context.typeAliases)};`);
  }
  out.push(`} ${name};`);
  return out.join("\n");
}
