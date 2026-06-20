import type { Diagnostic } from "core/diagnostics.ts";
import type { ConstDecl, FunctionDecl, TypeAliasDecl } from "core/ast.ts";
import { constantCName, functionCName, typeAliasCName } from "checker/c_symbol_names.ts";

type Str = string;

export function checkCOrdinarySymbols(
  functions: FunctionDecl[],
  typeAliases: TypeAliasDecl[],
  constants: ConstDecl[] = [],
): Diagnostic[] {
  return [
    ...checkFunctionOrdinarySymbols(functions, typeAliases, constants),
    ...checkConstantOrdinarySymbols(constants, functions, typeAliases),
  ];
}

function checkFunctionOrdinarySymbols(
  functions: FunctionDecl[],
  typeAliases: TypeAliasDecl[],
  constants: ConstDecl[],
): Diagnostic[] {
  const names = new Set<Str>([
    ...typeAliases.map(typeAliasCName),
    ...constants.map(constantCName),
  ]);
  return functions.filter((fn) => names.has(functionCName(fn))).map((fn) => ({
    message: `Duplicate C ordinary symbol '${functionCName(fn)}'`,
    span: fn.span,
  }));
}

function checkConstantOrdinarySymbols(
  constants: ConstDecl[],
  functions: FunctionDecl[],
  typeAliases: TypeAliasDecl[],
): Diagnostic[] {
  const names = new Set<Str>([
    ...functions.map(functionCName),
    ...typeAliases.map(typeAliasCName),
  ]);
  return constants.filter((constant) => names.has(constantCName(constant))).map((constant) => ({
    message: `Duplicate C ordinary symbol '${constantCName(constant)}'`,
    span: constant.span,
  }));
}
