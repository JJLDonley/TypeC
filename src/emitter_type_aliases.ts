import type { RecordTypeRef, TypeAliasDecl } from "./ast.ts";
import { emitCDeclarator } from "./c_type.ts";

type Str = string;

export function emitTypeAlias(typeAlias: TypeAliasDecl): Str {
  if (typeAlias.type.kind !== "RecordTypeRef") throw new Error("Only record type aliases can be emitted");
  return emitRecordTypeAlias(typeAlias.name, typeAlias.type);
}

function emitRecordTypeAlias(name: Str, type: RecordTypeRef): Str {
  const out: Str[] = [];
  out.push("typedef struct {");
  for (const field of type.fields) out.push(`  ${emitCDeclarator(field.type, field.name)};`);
  out.push(`} ${name};`);
  return out.join("\n");
}
