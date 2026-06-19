import type { Program } from "core/ast.ts";
import type { CastProgram } from "core/cast.ts";
import { lowerFunctionDecl, lowerImportDecl, lowerTypeAliasDecl } from "lower/declarations.ts";

export function lowerCast(program: CastProgram): Program {
  return {
    kind: "Program",
    imports: program.imports.map(lowerImportDecl),
    typeAliases: program.typeAliases.map(lowerTypeAliasDecl),
    functions: program.functions.map(lowerFunctionDecl),
    span: program.span,
  };
}
