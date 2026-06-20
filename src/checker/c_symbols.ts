import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

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
  aliases: Map<Str, TypeAliasDecl>,
): Diagnostic[] {
  if (functions.length < 2) return [];
  if (isCompatibleExternGroup(functions, aliases)) return [];
  return functions.slice(1).map((fn) => ({
    message: `Duplicate C function symbol '${name}'`,
    span: fn.span,
  }));
}

function isCompatibleExternGroup(functions: FunctionDecl[], aliases: Map<Str, TypeAliasDecl>): b8 {
  return functions.every((fn) => fn.external) &&
    functions.every((fn) => sameFunctionAbi(fn, functions[0], aliases));
}

function sameFunctionAbi(
  left: FunctionDecl,
  right: FunctionDecl | undefined,
  aliases: Map<Str, TypeAliasDecl>,
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
  aliases: Map<Str, TypeAliasDecl>,
): b8 {
  return right !== undefined && cParamShape(left, aliases) === cParamShape(right, aliases);
}

function cParamShape(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): Str {
  switch (type.kind) {
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}*`;
    default:
      return cTypeShape(type, aliases);
  }
}

function functionCName(fn: FunctionDecl): Str {
  return fn.cName ?? fn.name;
}

function indexTypeAliases(typeAliases: TypeAliasDecl[]): Map<Str, TypeAliasDecl> {
  return new Map<Str, TypeAliasDecl>(typeAliases.map((typeAlias) => [typeAlias.name, typeAlias]));
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
  aliases: Map<Str, TypeAliasDecl>,
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
  aliases: Map<Str, TypeAliasDecl>,
): b8 {
  return right !== undefined && cTypeShape(left.type, aliases) === cTypeShape(right.type, aliases);
}

function cTypeShape(type: TypeRef, aliases: Map<Str, TypeAliasDecl>): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return aliases.get(type.name)?.cName ?? typeName(type);
    case "PointerTypeRef":
      return `${cTypeShape(type.element, aliases)}*`;
    case "ReferenceTypeRef":
      return `${cTypeShape(type.element, aliases)}*`;
    case "SliceTypeRef":
      return `Slice<${cTypeShape(type.element, aliases)}>`;
    case "InferredArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}[]`;
    case "FixedArrayTypeRef":
      return `${cTypeShape(type.element, aliases)}[${type.sizeText}]`;
    case "RecordTypeRef":
      return `{${
        type.fields.map((field) => `${field.name}:${cTypeShape(field.type, aliases)}`).join(";")
      }}`;
  }
}

function typeAliasCName(typeAlias: TypeAliasDecl): Str {
  return typeAlias.cName ?? typeAlias.name;
}
