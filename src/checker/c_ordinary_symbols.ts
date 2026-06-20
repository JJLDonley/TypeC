import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeAliasDecl } from "core/ast.ts";
import { functionCName, typeAliasCName } from "checker/c_symbol_names.ts";

type Str = string;

export function checkCOrdinarySymbols(
  functions: FunctionDecl[],
  typeAliases: TypeAliasDecl[],
): Diagnostic[] {
  const typeNames = new Set<Str>(typeAliases.map(typeAliasCName));
  return functions.filter((fn) => typeNames.has(functionCName(fn))).map((fn) => ({
    message: `Duplicate C ordinary symbol '${functionCName(fn)}'`,
    span: fn.span,
  }));
}
