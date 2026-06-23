import type { Program } from "core/ast.ts";
import {
  collectConstDeps,
  collectEnumDeps,
  collectFunctionDeps,
  collectInterfaceDeps,
  collectTaggedUnionDeps,
  collectTypeAliasDeps,
} from "module/dependency_collectors.ts";
import {
  createDependencySet,
  type DependencySet,
  filterProgramDependencies,
  indexProgramDependencies,
  type ProgramDependencyIndex,
} from "module/dependency_index.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function selectDependencyClosure(
  program: Program,
  rootTypes: Str[],
  rootConstants: Str[],
  rootFunctions: Str[],
): Program {
  const index = indexProgramDependencies(program);
  const selected = createDependencySet(rootTypes, rootConstants, rootFunctions);
  collectClosure(selected, index);
  return filterProgramDependencies(program, selected);
}

function collectClosure(selected: DependencySet, index: ProgramDependencyIndex): void {
  let changed = true;
  while (changed) changed = collectPass(selected, index);
}

function collectPass(selected: DependencySet, index: ProgramDependencyIndex): b8 {
  const before = dependencyCount(selected);
  for (const name of [...selected.types]) {
    collectTypeAliasDeps(index.types.get(name), selected);
    collectInterfaceDeps(index.interfaces.get(name), selected);
    collectTaggedUnionDeps(index.taggedUnions.get(name), selected);
    collectEnumDeps(index.enums.get(name), selected);
    collectTypeMethodDeps(name, index, selected);
  }
  for (const name of [...selected.constants]) collectConstDeps(index.constants.get(name), selected);
  for (const name of [...selected.functions]) {
    collectFunctionDeps(index.functions.get(name), selected);
  }
  return dependencyCount(selected) !== before;
}

function collectTypeMethodDeps(
  typeName: Str,
  index: ProgramDependencyIndex,
  selected: DependencySet,
): void {
  for (const name of index.functions.keys()) {
    if (name.startsWith(`${typeName}.`)) selected.functions.add(name);
  }
}

function dependencyCount(selected: DependencySet): usize {
  return selected.types.size + selected.constants.size + selected.functions.size;
}
