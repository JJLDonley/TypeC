import type { Program } from "./ast.ts";
import type { CastProgram } from "./cast.ts";
import { lowerFunctionDecl, lowerImportDecl, lowerTypeAliasDecl } from "./lower_declarations.ts";

export function lowerCast(program: CastProgram): Program {
  return {
    kind: "Program",
    imports: program.imports.map(lowerImportDecl),
    typeAliases: program.typeAliases.map(lowerTypeAliasDecl),
    functions: program.functions.map(lowerFunctionDecl),
    span: program.span,
  };
}
