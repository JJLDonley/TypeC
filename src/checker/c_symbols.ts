import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import {
  cParamShape,
  cTypeShape,
  indexTypeAliases,
  type TypeAliasIndex,
} from "checker/c_abi_shapes.ts";
import { functionCName, typeAliasCName } from "checker/c_symbol_names.ts";

type Str = string;
type b8 = boolean;

export function checkCFunctionSymbols(
  functions: FunctionDecl[],
  typeAliases: TypeAliasDecl[] = [],
): Diagnostic[] {
  const aliases = indexTypeAliases(typeAliases);
  return [...groupFunctionsByCName(functions).entries()].flatMap((entry) =>
    checkCFunctionGroup(entry, aliases)
  );
}

export function checkCTypeAliasSymbols(typeAliases: TypeAliasDecl[]): Diagnostic[] {
  const aliases = indexTypeAliases(typeAliases);
  return [...groupTypeAliasesByCName(typeAliases).entries()].flatMap((entry) =>
    checkCTypeAliasGroup(entry, aliases)
  );
}

function groupFunctionsByCName(functions: FunctionDecl[]): Map<Str, FunctionDecl[]> {
  const groups = new Map<Str, FunctionDecl[]>();
  for (const fn of functions) addFunctionGroup(groups, fn);
  return groups;
}

function addFunctionGroup(groups: Map<Str, FunctionDecl[]>, fn: FunctionDecl): void {
  const name = functionCName(fn);
  groups.set(name, [...(groups.get(name) ?? []), fn]);
}

function checkCFunctionGroup(
  [name, functions]: [Str, FunctionDecl[]],
  aliases: TypeAliasIndex,
): Diagnostic[] {
  if (functions.length < 2) return [];
  if (isCompatibleExternGroup(functions, aliases)) return [];
  return functions.slice(1).map((fn) => ({
    message: `Duplicate C function symbol '${name}'`,
    span: fn.span,
  }));
}

function isCompatibleExternGroup(functions: FunctionDecl[], aliases: TypeAliasIndex): b8 {
  return functions.every((fn) => fn.external) &&
    functions.every((fn) => sameFunctionAbi(fn, functions[0], aliases));
}

function sameFunctionAbi(
  left: FunctionDecl,
  right: FunctionDecl | undefined,
  aliases: TypeAliasIndex,
): b8 {
  if (!right) return false;
  if (cTypeShape(left.returnType, aliases) !== cTypeShape(right.returnType, aliases)) return false;
  if (left.params.length !== right.params.length) return false;
  return left.params.every((param, index) =>
    sameParamAbi(param.type, right.params[index]?.type, aliases)
  );
}

function sameParamAbi(
  left: TypeRef,
  right: TypeRef | undefined,
  aliases: TypeAliasIndex,
): b8 {
  return right !== undefined && cParamShape(left, aliases) === cParamShape(right, aliases);
}

function groupTypeAliasesByCName(typeAliases: TypeAliasDecl[]): Map<Str, TypeAliasDecl[]> {
  const groups = new Map<Str, TypeAliasDecl[]>();
  for (const typeAlias of typeAliases) addTypeAliasGroup(groups, typeAlias);
  return groups;
}

function addTypeAliasGroup(groups: Map<Str, TypeAliasDecl[]>, typeAlias: TypeAliasDecl): void {
  const name = typeAliasCName(typeAlias);
  groups.set(name, [...(groups.get(name) ?? []), typeAlias]);
}

function checkCTypeAliasGroup(
  [name, typeAliases]: [Str, TypeAliasDecl[]],
  aliases: TypeAliasIndex,
): Diagnostic[] {
  if (typeAliases.length < 2) return [];
  if (typeAliases.every((typeAlias) => sameTypeAliasAbi(typeAlias, typeAliases[0], aliases))) {
    return [];
  }
  return typeAliases.slice(1).map((typeAlias) => ({
    message: `Duplicate C type symbol '${name}'`,
    span: typeAlias.span,
  }));
}

function sameTypeAliasAbi(
  left: TypeAliasDecl,
  right: TypeAliasDecl | undefined,
  aliases: TypeAliasIndex,
): b8 {
  return right !== undefined && cTypeShape(left.type, aliases) === cTypeShape(right.type, aliases);
}
