import type { ConstDecl, EnumDecl, FunctionDecl, Program, TypeAliasDecl } from "core/ast.ts";

type Str = string;

export interface DependencySet {
  types: Set<Str>;
  constants: Set<Str>;
  functions: Set<Str>;
}

export interface ProgramDependencyIndex {
  types: Map<Str, TypeAliasDecl>;
  enums: Map<Str, EnumDecl>;
  constants: Map<Str, ConstDecl>;
  functions: Map<Str, FunctionDecl>;
}

export function indexProgramDependencies(program: Program): ProgramDependencyIndex {
  return {
    types: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    enums: new Map((program.enums ?? []).map((enumDecl) => [enumDecl.name, enumDecl])),
    constants: new Map((program.constants ?? []).map((constant) => [constant.name, constant])),
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
  };
}

export function createDependencySet(
  types: Str[],
  constantsOrFunctions: Str[],
  functions: Str[] = [],
): DependencySet {
  const constants = arguments.length < 3 ? [] : constantsOrFunctions;
  const selectedFunctions = arguments.length < 3 ? constantsOrFunctions : functions;
  return {
    types: new Set(types),
    constants: new Set(constants),
    functions: new Set(selectedFunctions),
  };
}

export function filterProgramDependencies(program: Program, selected: DependencySet): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: program.typeAliases.filter((typeAlias) => selected.types.has(typeAlias.name)),
    enums: (program.enums ?? []).filter((enumDecl) => selected.types.has(enumDecl.name)),
    constants: (program.constants ?? []).filter((constant) =>
      selected.constants.has(constant.name)
    ),
    functions: program.functions.filter((fn) => selected.functions.has(fn.name)),
    span: program.span,
  };
}
