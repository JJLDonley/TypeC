import type { Diagnostic } from "../diagnostics.ts";
import type { TypeAliasDecl } from "../ast.ts";
import { collectTypeAliasRefs } from "checker/type_refs.ts";

type Str = string;
type usize = number;

export function checkTypeAliasOrder(typeAliases: TypeAliasDecl[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const indexes = typeAliasIndexes(typeAliases);
  for (let index: usize = 0; index < typeAliases.length; index++) {
    diagnostics.push(...checkTypeAliasDeps(typeAliases[index]!, index, indexes));
  }
  return diagnostics;
}

function typeAliasIndexes(typeAliases: TypeAliasDecl[]): Map<Str, usize> {
  const indexes = new Map<Str, usize>();
  for (let index: usize = 0; index < typeAliases.length; index++) indexes.set(typeAliases[index]!.name, index);
  return indexes;
}

function checkTypeAliasDeps(typeAlias: TypeAliasDecl, index: usize, indexes: Map<Str, usize>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const name of collectTypeAliasRefs(typeAlias.type)) {
    const refIndex = indexes.get(name);
    if (refIndex === undefined || refIndex < index) continue;
    diagnostics.push({
      message: `Type alias '${typeAlias.name}' cannot depend on '${name}' before it is declared`,
      span: typeAlias.span,
    });
  }
  return diagnostics;
}
