import type { TypeRef } from "core/ast.ts";
import type { TypeAliasDecl } from "core/ast.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;

export type LocalTypes = Map<Str, Str>;

export function childLocalTypes(locals: LocalTypes): LocalTypes {
  return new Map<Str, Str>(locals);
}

export function registerLocalType(
  locals: LocalTypes,
  name: Str,
  type: TypeRef,
  typeAliases: Map<Str, TypeAliasDecl>,
): void {
  locals.set(name, emitCTypeName(type, typeAliases));
}
