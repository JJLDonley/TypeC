import type { ConstDecl, FunctionDecl, TypeAliasDecl } from "core/ast.ts";

type Str = string;

export function functionCName(fn: FunctionDecl): Str {
  return fn.cName ?? fn.name;
}

export function typeAliasCName(typeAlias: TypeAliasDecl): Str {
  return typeAlias.cName ?? typeAlias.name;
}

export function constantCName(constant: ConstDecl): Str {
  return constant.cName ?? constant.name;
}
