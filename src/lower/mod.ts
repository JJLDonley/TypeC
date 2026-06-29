import type { Program, TypeAliasDecl } from "core/ast.ts";
import type { CastProgram } from "core/cast.ts";
import {
  lowerClassConstants,
  lowerClassMethods,
  lowerClassTypeAlias,
  lowerConstDecl,
  lowerEnumDecl,
  lowerExportDecl,
  lowerFunctionDecl,
  lowerImportDecl,
  lowerInterfaceDecl,
  lowerStructTypeAlias,
  lowerTaggedUnionDecl,
  lowerTypeAliasDecl,
} from "lower/declarations.ts";
import { lowerConditionalTypeAliases } from "lower/conditional_type_aliases.ts";
import { instantiateGenericClasses } from "lower/generic_classes.ts";
import { instantiateGenericTypeAliases } from "lower/generic_type_aliases.ts";
import { lowerIntersectionTypeAliases } from "lower/intersection_type_aliases.ts";
import { lowerMappedTypeAliases } from "lower/mapped_type_aliases.ts";
import { flattenNamespaces } from "lower/namespaces.ts";
import { lowerStaticReflectionTypeAliases } from "lower/static_reflection_type_aliases.ts";
import { type LoweredUnionAliases, lowerUnionTypeAliases } from "lower/union_type_aliases.ts";

type b8 = boolean;
type usize = number;

export function lowerCast(program: CastProgram): Program {
  const cast = instantiateGenericTypeAliases(instantiateGenericClasses(flattenNamespaces(program)));
  const constants = [
    ...(cast.constants ?? []).map(lowerConstDecl),
    ...(cast.classes ?? []).flatMap(lowerClassConstants),
  ];
  const functions = [
    ...cast.functions.map(lowerFunctionDecl),
    ...(cast.classes ?? []).flatMap(lowerClassMethods),
  ];
  const interfaces = (cast.interfaces ?? []).map(lowerInterfaceDecl);
  const typeAliases = orderedTypeAliases(cast);
  const concreteAliases: TypeAliasDecl[] = lowerIntersectionTypeAliases(
    lowerMappedTypeAliases(
      lowerConditionalTypeAliases(
        lowerStaticReflectionTypeAliases(typeAliases, constants, functions, interfaces),
      ),
    ),
  );
  const aliases: LoweredUnionAliases = lowerUnionTypeAliases(concreteAliases);
  return {
    kind: "Program",
    imports: cast.imports.map(lowerImportDecl),
    exports: (cast.exports ?? []).map(lowerExportDecl),
    defaultExport: cast.defaultExport,
    typeAliases: aliases.typeAliases,
    interfaces,
    taggedUnions: [...(cast.taggedUnions ?? []).map(lowerTaggedUnionDecl), ...aliases.taggedUnions],
    enums: (cast.enums ?? []).map(lowerEnumDecl),
    constants,
    functions,
    span: cast.span,
  };
}

function orderedTypeAliases(cast: CastProgram): TypeAliasDecl[] {
  return [
    ...regularTypeAliases(cast).map(lowerTypeAliasDecl),
    ...(cast.structs ?? []).map(lowerStructTypeAlias),
    ...(cast.classes ?? []).flatMap(lowerClassAliases),
    ...generatedGenericTypeAliases(cast).map(lowerTypeAliasDecl),
  ];
}

function regularTypeAliases(cast: CastProgram): CastProgram["typeAliases"] {
  return cast.typeAliases.filter((alias) => !isGeneratedGenericTypeAlias(alias));
}

function generatedGenericTypeAliases(cast: CastProgram): CastProgram["typeAliases"] {
  return cast.typeAliases.filter(isGeneratedGenericTypeAlias);
}

function isGeneratedGenericTypeAlias(alias: CastProgram["typeAliases"][usize]): b8 {
  return alias.generated === true;
}

function lowerClassAliases(classDecl: NonNullable<CastProgram["classes"]>[usize]): TypeAliasDecl[] {
  return [lowerClassTypeAlias(classDecl)];
}

export * from "lower/declarations.ts";
export * from "lower/conditional_type_aliases.ts";
export * from "lower/generic_classes.ts";
export * from "lower/generic_type_aliases.ts";
export * from "lower/intersection_type_aliases.ts";
export * from "lower/mapped_type_aliases.ts";
export * from "lower/namespaces.ts";
export * from "lower/static_reflection_type_aliases.ts";
export * from "lower/union_type_aliases.ts";
export * from "lower/expressions.ts";
export * from "lower/statements.ts";
export * from "lower/types.ts";
