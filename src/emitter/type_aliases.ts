import type { RecordTypeRef, TypeAliasDecl } from "core/ast.ts";
import { emitCDeclarator } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function emitTypeAlias(typeAlias: TypeAliasDecl, context: EmitContext): Str {
  if (typeAlias.type.kind !== "RecordTypeRef") {
    throw new Error("Only record type aliases can be emitted");
  }
  return emitRecordTypeAlias(
    typeAliasName(typeAlias),
    typeAliasTag(typeAlias),
    typeAlias.type,
    context,
  );
}

function typeAliasName(typeAlias: TypeAliasDecl): Str {
  return typeAlias.cName ?? typeAlias.name;
}

function typeAliasTag(typeAlias: TypeAliasDecl): Str | null {
  return typeAlias.cName ?? null;
}

function emitRecordTypeAlias(
  name: Str,
  tag: Str | null,
  type: RecordTypeRef,
  context: EmitContext,
): Str {
  const out: Str[] = [];
  out.push(`typedef struct${tagSuffix(tag)} {`);
  for (const field of type.fields) {
    out.push(`  ${emitCDeclarator(field.type, field.name, context.typeAliases)};`);
  }
  out.push(`} ${name};`);
  return out.join("\n");
}

function tagSuffix(tag: Str | null): Str {
  return tag === null ? "" : ` ${tag}`;
}
