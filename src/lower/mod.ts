import type { Program } from "core/ast.ts";
import type { CastProgram } from "core/cast.ts";
import {
  lowerClassMethods,
  lowerClassTypeAlias,
  lowerConstDecl,
  lowerEnumDecl,
  lowerFunctionDecl,
  lowerImportDecl,
  lowerTypeAliasDecl,
} from "lower/declarations.ts";

export function lowerCast(program: CastProgram): Program {
  return {
    kind: "Program",
    imports: program.imports.map(lowerImportDecl),
    typeAliases: [
      ...program.typeAliases.map(lowerTypeAliasDecl),
      ...(program.classes ?? []).map(lowerClassTypeAlias),
    ],
    enums: (program.enums ?? []).map(lowerEnumDecl),
    constants: (program.constants ?? []).map(lowerConstDecl),
    functions: [
      ...program.functions.map(lowerFunctionDecl),
      ...(program.classes ?? []).flatMap(lowerClassMethods),
    ],
    span: program.span,
  };
}

export * from "lower/declarations.ts";
export * from "lower/expressions.ts";
export * from "lower/statements.ts";
export * from "lower/types.ts";
