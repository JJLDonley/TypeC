import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { FunctionDecl, Program, TypeAliasDecl } from "core/ast.ts";
import { selectDependencyClosure } from "module/dependencies.ts";

type Str = string;

export function exportAllFunctions(program: Program): Program {
  return { ...program, functions: program.functions.map((fn) => ({ ...fn, exported: true })) };
}

export function mergeProgram(local: Program, imports: Program[]): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: uniqueRefs([
      ...imports.flatMap((program) => program.typeAliases),
      ...local.typeAliases,
    ]),
    functions: uniqueRefs([...imports.flatMap((program) => program.functions), ...local.functions]),
    span: local.span,
  };
}

export function selectImports(program: Program, names: Str[], span: Diagnostic["span"]): Program {
  const typeAliases = names.flatMap((name) => selectTypeAlias(program.typeAliases, name));
  const functions = names.flatMap((name) => selectFunction(program.functions, name));
  const found = new Set<Str>([
    ...typeAliases.map((decl) => decl.name),
    ...functions.map((decl) => decl.name),
  ]);
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new TypeCError(
      missing.map((name) => ({ message: `Module does not export '${name}'`, span })),
    );
  }
  return selectDependencyClosure(
    program,
    typeAliases.map((typeAlias) => typeAlias.name),
    functions.map((fn) => fn.name),
  );
}

export function selectNamespaceImports(program: Program, namespace: Str): Program {
  const typeAliases = program.typeAliases.filter((typeAlias) => typeAlias.exported).map((
    typeAlias,
  ) => namespaceTypeAlias(typeAlias, namespace));
  const functions = program.functions.filter((fn) => fn.exported).map((fn) =>
    namespaceFunction(fn, namespace)
  );
  return { kind: "Program", imports: [], typeAliases, functions, span: program.span };
}

function namespaceTypeAlias(typeAlias: TypeAliasDecl, namespace: Str): TypeAliasDecl {
  return {
    ...typeAlias,
    exported: false,
    name: `${namespace}.${typeAlias.name}`,
    cName: typeAlias.cName ?? typeAlias.name,
  };
}

function namespaceFunction(fn: FunctionDecl, namespace: Str): FunctionDecl {
  return { ...fn, exported: false, name: `${namespace}.${fn.name}`, cName: fn.cName ?? fn.name };
}

function uniqueRefs<T>(items: T[]): T[] {
  return [...new Set<T>(items)];
}

function selectTypeAlias(typeAliases: TypeAliasDecl[], name: Str): TypeAliasDecl[] {
  return typeAliases.filter((typeAlias) => typeAlias.exported && typeAlias.name === name);
}

function selectFunction(functions: FunctionDecl[], name: Str): FunctionDecl[] {
  return functions.filter((fn) => fn.exported && fn.name === name);
}
