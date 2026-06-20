import type { TypeAliasDecl } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitTypeAlias } from "emitter/type_aliases.ts";

type Str = string;

export interface EmittedTypeAlias {
  alias: TypeAliasDecl;
  text: Str;
}

export function collectEmittedTypeAliases(
  typeAliases: TypeAliasDecl[],
  context: EmitContext,
): EmittedTypeAlias[] {
  const seen = new Map<Str, Str>();
  const emitted: EmittedTypeAlias[] = [];
  for (const alias of typeAliases) collectEmittedTypeAlias(alias, context, seen, emitted);
  return emitted;
}

function collectEmittedTypeAlias(
  alias: TypeAliasDecl,
  context: EmitContext,
  seen: Map<Str, Str>,
  emitted: EmittedTypeAlias[],
): void {
  const text = emitTypeAlias(alias, context);
  const previous = seen.get(alias.cName ?? alias.name);
  if (previous === text) return;
  if (previous) throw new Error(`Duplicate C type alias '${alias.cName ?? alias.name}'`);
  seen.set(alias.cName ?? alias.name, text);
  emitted.push({ alias, text });
}
