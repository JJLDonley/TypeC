import type { FunctionDecl, Program, TypeAliasDecl } from "core/ast.ts";

type Str = string;

export interface DependencySet {
  types: Set<Str>;
  functions: Set<Str>;
}

export interface ProgramDependencyIndex {
  types: Map<Str, TypeAliasDecl>;
  functions: Map<Str, FunctionDecl>;
}

export function indexProgramDependencies(program: Program): ProgramDependencyIndex {
  return {
    types: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
  };
}

export function createDependencySet(types: Str[], functions: Str[]): DependencySet {
  return { types: new Set(types), functions: new Set(functions) };
}

export function filterProgramDependencies(program: Program, selected: DependencySet): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: program.typeAliases.filter((typeAlias) => selected.types.has(typeAlias.name)),
    functions: program.functions.filter((fn) => selected.functions.has(fn.name)),
    span: program.span,
  };
}
