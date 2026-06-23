import type { Program } from "core/ast.ts";
import type { CastProgram } from "core/cast.ts";
import {
  lowerClassMethods,
  lowerClassTypeAlias,
  lowerConstDecl,
  lowerEnumDecl,
  lowerFunctionDecl,
  lowerImportDecl,
  lowerInterfaceDecl,
  lowerTypeAliasDecl,
} from "lower/declarations.ts";
import { instantiateGenericClasses } from "lower/generic_classes.ts";

export function lowerCast(program: CastProgram): Program {
  const cast = instantiateGenericClasses(program);
  return {
    kind: "Program",
    imports: cast.imports.map(lowerImportDecl),
    typeAliases: [
      ...cast.typeAliases.map(lowerTypeAliasDecl),
      ...(cast.classes ?? []).map(lowerClassTypeAlias),
    ],
    interfaces: (cast.interfaces ?? []).map(lowerInterfaceDecl),
    enums: (cast.enums ?? []).map(lowerEnumDecl),
    constants: (cast.constants ?? []).map(lowerConstDecl),
    functions: [
      ...cast.functions.map(lowerFunctionDecl),
      ...(cast.classes ?? []).flatMap(lowerClassMethods),
    ],
    span: cast.span,
  };
}

export * from "lower/declarations.ts";
export * from "lower/generic_classes.ts";
export * from "lower/expressions.ts";
export * from "lower/statements.ts";
export * from "lower/types.ts";
