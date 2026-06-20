import type { FunctionDecl, TypeAliasDecl } from "core/ast.ts";

type Str = string;

export function functionCName(fn: FunctionDecl): Str {
  return fn.cName ?? fn.name;
}

export function typeAliasCName(typeAlias: TypeAliasDecl): Str {
  return typeAlias.cName ?? typeAlias.name;
}
