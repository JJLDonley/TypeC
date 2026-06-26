import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { checkCallArgumentType, checkCallArity } from "checker/call_args.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function overloadGroups(functions: FunctionDecl[]): Map<Str, FunctionDecl[]> {
  const groups = new Map<Str, FunctionDecl[]>();
  for (const fn of functions) addOverload(groups, fn);
  return groups;
}

function addOverload(groups: Map<Str, FunctionDecl[]>, fn: FunctionDecl): void {
  if (fn.overload !== true) return;
  groups.set(fn.name, [...(groups.get(fn.name) ?? []), fn]);
}

export function runtimeFunctions(functions: FunctionDecl[]): FunctionDecl[] {
  return functions.filter((fn) => fn.overload !== true);
}

export function checkOverloadDeclarations(functions: FunctionDecl[]): Diagnostic[] {
  return [...groupByName(functions).values()].flatMap(checkOverloadGroup);
}

function groupByName(functions: FunctionDecl[]): FunctionDecl[][] {
  const groups = new Map<Str, FunctionDecl[]>();
  for (const fn of functions) groups.set(fn.name, [...(groups.get(fn.name) ?? []), fn]);
  return [...groups.values()];
}

function checkOverloadGroup(functions: FunctionDecl[]): Diagnostic[] {
  const overloads = functions.filter((fn) => fn.overload === true);
  if (overloads.length === 0) return [];
  const implementations = functions.filter((fn) => fn.overload !== true && !fn.external);
  return [
    ...checkOverloadOrder(functions),
    ...checkOverloadImplementation(overloads, implementations),
  ];
}

function checkOverloadOrder(functions: FunctionDecl[]): Diagnostic[] {
  const implementationIndex = functions.findIndex((fn) => fn.overload !== true && !fn.external);
  if (implementationIndex < 0) return [];
  return functions.slice(implementationIndex + 1)
    .filter((fn) => fn.overload === true)
    .map((fn) => ({
      message: `Overload declaration for '${fn.name}' must appear before implementation`,
      span: fn.span,
    }));
}

function checkOverloadImplementation(
  overloads: FunctionDecl[],
  implementations: FunctionDecl[],
): Diagnostic[] {
  if (implementations.length === 1) return [];
  return overloads.map((fn) => ({
    message: `Overloaded function '${fn.name}' requires exactly one implementation`,
    span: fn.span,
  }));
}

export function matchingOverloads(
  overloads: FunctionDecl[],
  args: TypeName[],
): FunctionDecl[] {
  return overloads.filter((fn) => overloadMatches(fn, args));
}

function overloadMatches(fn: FunctionDecl, args: TypeName[]): b8 {
  if (
    checkCallArity(
      args.length,
      fn.params.length,
      fn.variadic === true,
      fn.name,
      fn.span,
      minArgumentCount(fn),
    ).length > 0
  ) {
    return false;
  }
  for (let index: usize = 0; index < args.length && index < fn.params.length; index++) {
    if (!argumentMatches(args[index]!, fn.params[index]!)) return false;
  }
  return true;
}

function argumentMatches(actual: TypeName, param: FunctionDecl["params"][usize]): b8 {
  if (param.optional === true) return optionalArgumentMatches(actual, param.type);
  return checkCallArgumentType(actual, typeName(param.type), 0, param.span).length === 0;
}

function optionalArgumentMatches(actual: TypeName, type: TypeRef): b8 {
  const element = optionalTypeElement(type);
  if (element === null) return false;
  return checkCallArgumentType(actual, typeName(element), 0, element.span).length === 0;
}

function minArgumentCount(fn: FunctionDecl): usize {
  const index = fn.params.findIndex((param) => param.optional === true || param.defaultValue);
  return index < 0 ? fn.params.length : index;
}
