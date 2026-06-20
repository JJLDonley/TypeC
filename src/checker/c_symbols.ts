import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

export function checkCFunctionSymbols(functions: FunctionDecl[]): Diagnostic[] {
  return [...groupFunctionsByCName(functions).entries()].flatMap((entry) =>
    checkCFunctionGroup(entry)
  );
}

function groupFunctionsByCName(functions: FunctionDecl[]): Map<Str, FunctionDecl[]> {
  const groups = new Map<Str, FunctionDecl[]>();
  for (const fn of functions) addFunctionGroup(groups, fn);
  return groups;
}

function addFunctionGroup(groups: Map<Str, FunctionDecl[]>, fn: FunctionDecl): void {
  const name = functionCName(fn);
  groups.set(name, [...(groups.get(name) ?? []), fn]);
}

function checkCFunctionGroup([name, functions]: [Str, FunctionDecl[]]): Diagnostic[] {
  if (functions.length < 2) return [];
  if (isCompatibleExternGroup(functions)) return [];
  return functions.slice(1).map((fn) => ({
    message: `Duplicate C function symbol '${name}'`,
    span: fn.span,
  }));
}

function isCompatibleExternGroup(functions: FunctionDecl[]): b8 {
  return functions.every((fn) => fn.external) &&
    functions.every((fn) => sameFunctionAbi(fn, functions[0]));
}

function sameFunctionAbi(left: FunctionDecl, right: FunctionDecl | undefined): b8 {
  if (!right) return false;
  if (typeName(left.returnType) !== typeName(right.returnType)) return false;
  if (left.params.length !== right.params.length) return false;
  return left.params.every((param, index) => sameType(param.type, right.params[index]?.type));
}

function sameType(left: TypeRef, right: TypeRef | undefined): b8 {
  return right !== undefined && typeName(left) === typeName(right);
}

function functionCName(fn: FunctionDecl): Str {
  return fn.cName ?? fn.name;
}
