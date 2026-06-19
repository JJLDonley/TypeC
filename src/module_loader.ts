import type { Diagnostic } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { FunctionDecl, Program, TypeAliasDecl } from "./ast.ts";
import { lex } from "./lexer.ts";
import { selectDependencyClosure } from "./module_dependencies.ts";
import { parse } from "./parser.ts";

type Str = string;
type b8 = boolean;

interface LoadState {
  loaded: Map<Str, Program>;
  loading: Set<Str>;
}

interface ImportRequest {
  path: Str;
  names: Set<Str>;
  span: Diagnostic["span"];
}

export async function loadProgram(entryPath: Str): Promise<Program> {
  const state = { loaded: new Map<Str, Program>(), loading: new Set<Str>() };
  return await loadModule(normalizePath(entryPath), state);
}

async function loadModule(path: Str, state: LoadState): Promise<Program> {
  const canonicalPath = await canonicalModulePath(path);
  const loaded = state.loaded.get(canonicalPath);
  if (loaded) return loaded;
  if (state.loading.has(canonicalPath)) throw new TypeCError([{ message: `Import cycle involving '${canonicalPath}'` }]);

  state.loading.add(canonicalPath);
  const source = await Deno.readTextFile(canonicalPath);
  const local = parse(lex(source));
  const imported = await collectImports(canonicalPath, local, state);
  const merged = mergeProgram(local, imported);
  state.loading.delete(canonicalPath);
  state.loaded.set(canonicalPath, merged);
  return merged;
}

async function collectImports(path: Str, program: Program, state: LoadState): Promise<Program[]> {
  const programs: Program[] = [];
  for (const request of collectImportRequests(path, program)) {
    const imported = await loadModule(request.path, state);
    programs.push(selectImports(imported, [...request.names], request.span));
  }
  return programs;
}

function collectImportRequests(path: Str, program: Program): ImportRequest[] {
  const requests = new Map<Str, ImportRequest>();
  for (const importDecl of program.imports) {
    validateImportPath(importDecl.path, importDecl.span);
    const importedPath = resolveImportPath(path, importDecl.path);
    const request = requests.get(importedPath) ?? createImportRequest(importedPath, importDecl.span);
    for (const name of importDecl.names) request.names.add(name);
    requests.set(importedPath, request);
  }
  return [...requests.values()];
}

function createImportRequest(path: Str, span: Diagnostic["span"]): ImportRequest {
  return { path, names: new Set<Str>(), span };
}

function validateImportPath(path: Str, span: Diagnostic["span"]): void {
  if (!isRelativeImportPath(path)) throw new TypeCError([{ message: `Import path '${path}' must be relative`, span }]);
  if (!path.endsWith(".tc")) throw new TypeCError([{ message: `Import path '${path}' must target a .tc file`, span }]);
}

function isRelativeImportPath(path: Str): b8 {
  return path.startsWith("./") || path.startsWith("../");
}

function mergeProgram(local: Program, imports: Program[]): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: uniqueRefs([...imports.flatMap((program) => program.typeAliases), ...local.typeAliases]),
    functions: uniqueRefs([...imports.flatMap((program) => program.functions), ...local.functions]),
    span: local.span,
  };
}

function uniqueRefs<T>(items: T[]): T[] {
  return [...new Set<T>(items)];
}

function selectImports(program: Program, names: Str[], span: Diagnostic["span"]): Program {
  const typeAliases = names.flatMap((name) => selectTypeAlias(program.typeAliases, name));
  const functions = names.flatMap((name) => selectFunction(program.functions, name));
  const found = new Set<Str>([...typeAliases.map((decl) => decl.name), ...functions.map((decl) => decl.name)]);
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) throw new TypeCError(missing.map((name) => ({ message: `Module does not export '${name}'`, span })));
  return selectDependencyClosure(program, typeAliases.map((typeAlias) => typeAlias.name), functions.map((fn) => fn.name));
}

function selectTypeAlias(typeAliases: TypeAliasDecl[], name: Str): TypeAliasDecl[] {
  return typeAliases.filter((typeAlias) => typeAlias.exported && typeAlias.name === name);
}

function selectFunction(functions: FunctionDecl[], name: Str): FunctionDecl[] {
  return functions.filter((fn) => fn.exported && fn.name === name);
}

function resolveImportPath(fromPath: Str, importPath: Str): Str {
  return normalizePath(new URL(importPath, fileDirectoryUrl(fromPath)).pathname);
}

function fileDirectoryUrl(path: Str): URL {
  const url = new URL(`file://${normalizePath(path)}`);
  return new URL("./", url);
}

async function canonicalModulePath(path: Str): Promise<Str> {
  return await Deno.realPath(path);
}

function normalizePath(path: Str): Str {
  return path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
}
