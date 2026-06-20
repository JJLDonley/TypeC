import type { Diagnostic } from "core/diagnostics.ts";
import type { ConstDecl, FunctionDecl, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkCOrdinarySymbols } from "checker/c_ordinary_symbols.ts";
import { checkCFunctionSymbols, checkCTypeAliasSymbols } from "checker/c_symbols.ts";
import { checkDeclarations } from "checker/declarations.ts";

type Str = string;

export interface CheckedDeclarations {
  functions: Map<Str, FunctionDecl>;
  constants: Map<Str, ConstDecl>;
  typeAliases: Map<Str, TypeRef>;
  diagnostics: Diagnostic[];
}

export function collectProgramDeclarations(program: ResolvedProgram): CheckedDeclarations {
  const declarations = checkDeclarations(program);
  return {
    functions: declarations.functions,
    constants: declarations.constants,
    typeAliases: declarations.typeAliases,
    diagnostics: [
      ...declarations.diagnostics,
      ...checkCFunctionSymbols(program.functions, program.typeAliases),
      ...checkCTypeAliasSymbols(program.typeAliases),
      ...checkCOrdinarySymbols(program.functions, program.typeAliases),
    ],
  };
}
