import type { Diagnostic } from "core/diagnostics.ts";
import type { ConstDecl, FunctionDecl, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkCOrdinarySymbols } from "checker/c_ordinary_symbols.ts";
import {
  checkCConstantSymbols,
  checkCFunctionSymbols,
  checkCTypeAliasSymbols,
} from "checker/c_symbols.ts";
import { checkDeclarations } from "checker/declarations.ts";
import { checkEnums } from "checker/enums.ts";
import { checkInterfaces } from "checker/interfaces.ts";
import { taggedUnionTagConstants } from "core/tagged_union_constants.ts";
import { runtimeFunctions } from "checker/overloads.ts";

type Str = string;

export interface CheckedDeclarations {
  functions: Map<Str, FunctionDecl>;
  constants: Map<Str, ConstDecl>;
  typeAliases: Map<Str, TypeRef>;
  diagnostics: Diagnostic[];
}

export function collectProgramDeclarations(program: ResolvedProgram): CheckedDeclarations {
  const declarations = checkDeclarations(program);
  const enums = checkEnums(program.enums ?? [], declarations.constants);
  const constants = new Map<Str, ConstDecl>(declarations.constants);
  for (const constant of enums.constants) constants.set(constant.name, constant);
  for (const constant of taggedUnionTagConstants(program.taggedUnions ?? [])) {
    constants.set(constant.name, constant);
  }
  return {
    functions: declarations.functions,
    constants,
    typeAliases: declarations.typeAliases,
    diagnostics: [
      ...declarations.diagnostics,
      ...checkInterfaces(program.interfaces ?? [], declarations.typeAliases),
      ...enums.diagnostics,
      ...checkCFunctionSymbols(runtimeFunctions(program.functions), program.typeAliases),
      ...checkCTypeAliasSymbols(program.typeAliases),
      ...checkCConstantSymbols(program.constants ?? []),
      ...checkCOrdinarySymbols(
        runtimeFunctions(program.functions),
        program.typeAliases,
        program.constants ?? [],
      ),
    ],
  };
}
