import type { Program } from "core/ast.ts";
import { collectFunctionDeps, collectTypeAliasDeps } from "module/dependency_collectors.ts";
import { createDependencySet, filterProgramDependencies, indexProgramDependencies, type DependencySet, type ProgramDependencyIndex } from "module/dependency_index.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function selectDependencyClosure(program: Program, rootTypes: Str[], rootFunctions: Str[]): Program {
  const index = indexProgramDependencies(program);
  const selected = createDependencySet(rootTypes, rootFunctions);
  collectClosure(selected, index);
  return filterProgramDependencies(program, selected);
}

function collectClosure(selected: DependencySet, index: ProgramDependencyIndex): void {
  let changed = true;
  while (changed) changed = collectPass(selected, index);
}

function collectPass(selected: DependencySet, index: ProgramDependencyIndex): b8 {
  const before = dependencyCount(selected);
  for (const name of [...selected.types]) collectTypeAliasDeps(index.types.get(name), selected);
  for (const name of [...selected.functions]) collectFunctionDeps(index.functions.get(name), selected);
  return dependencyCount(selected) !== before;
}

function dependencyCount(selected: DependencySet): usize {
  return selected.types.size + selected.functions.size;
}


