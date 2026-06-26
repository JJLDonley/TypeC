import type { Program, TypeAliasDecl } from "core/ast.ts";
import type { CastProgram } from "core/cast.ts";
import {
  lowerClassMethods,
  lowerClassTypeAlias,
  lowerClassVTableDecl,
  lowerClassVTableTypeAlias,
  lowerConstDecl,
  lowerEnumDecl,
  lowerFunctionDecl,
  lowerImportDecl,
  lowerInterfaceDecl,
  lowerStructTypeAlias,
  lowerTaggedUnionDecl,
  lowerTypeAliasDecl,
} from "lower/declarations.ts";
import { lowerConditionalTypeAliases } from "lower/conditional_type_aliases.ts";
import { instantiateGenericClasses } from "lower/generic_classes.ts";
import { lowerIntersectionTypeAliases } from "lower/intersection_type_aliases.ts";
import { lowerMappedTypeAliases } from "lower/mapped_type_aliases.ts";
import { type LoweredUnionAliases, lowerUnionTypeAliases } from "lower/union_type_aliases.ts";

export function lowerCast(program: CastProgram): Program {
  const cast = instantiateGenericClasses(program);
  const concreteAliases: TypeAliasDecl[] = lowerIntersectionTypeAliases(
    lowerMappedTypeAliases(
      lowerConditionalTypeAliases([
        ...cast.typeAliases.map(lowerTypeAliasDecl),
        ...(cast.structs ?? []).map(lowerStructTypeAlias),
        ...(cast.classes ?? []).flatMap((classDecl) => [
          lowerClassTypeAlias(classDecl),
          lowerClassVTableTypeAlias(classDecl),
        ]),
      ]),
    ),
  );
  const aliases: LoweredUnionAliases = lowerUnionTypeAliases(concreteAliases);
  return {
    kind: "Program",
    imports: cast.imports.map(lowerImportDecl),
    typeAliases: aliases.typeAliases,
    interfaces: (cast.interfaces ?? []).map(lowerInterfaceDecl),
    classVTables: (cast.classes ?? []).map(lowerClassVTableDecl),
    taggedUnions: [...(cast.taggedUnions ?? []).map(lowerTaggedUnionDecl), ...aliases.taggedUnions],
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
export * from "lower/conditional_type_aliases.ts";
export * from "lower/generic_classes.ts";
export * from "lower/intersection_type_aliases.ts";
export * from "lower/mapped_type_aliases.ts";
export * from "lower/union_type_aliases.ts";
export * from "lower/expressions.ts";
export * from "lower/statements.ts";
export * from "lower/types.ts";
