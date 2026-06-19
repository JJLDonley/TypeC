import type { Diagnostic } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import { generateExternsFromHeader } from "./c_header_generator.ts";
import type { FunctionDecl, Program, TypeAliasDecl } from "./ast.ts";
import { lex } from "./lexer.ts";
import { selectDependencyClosure } from "./module_dependencies.ts";
import { parse } from "./parser.ts";
import { hasParentTraversal } from "./path_security.ts";
import { loadProjectConfig, type ProjectConfig } from "./project_config.ts";

type Str = string;
type b8 = boolean;

interface LoadState {
  loaded: Map<Str, Program>;
  loading: Set<Str>;
  config: ProjectConfig;
}

interface ImportRequest {
  path: Str;
  names: Set<Str>;
  span: Diagnostic["span"];
}

export async function loadProgram(entryPath: Str, config: ProjectConfig | null = null): Promise<Program> {
  const resolvedConfig = config ?? await loadProjectConfig(entryPath);
  const state = { loaded: new Map<Str, Program>(), loading: new Set<Str>(), config: resolvedConfig };
  return await loadModule(normalizePath(entryPath), state);
}

async function loadModule(path: Str, state: LoadState): Promise<Program> {
  const canonicalPath = await canonicalModulePath(path);
  const loaded = state.loaded.get(canonicalPath);
  if (loaded) return loaded;
  if (state.loading.has(canonicalPath)) throw new TypeCError([{ message: `Import cycle involving '${canonicalPath}'` }]);

  state.loading.add(canonicalPath);
  const merged = await loadCanonicalModule(canonicalPath, state);
  state.loading.delete(canonicalPath);
  state.loaded.set(canonicalPath, merged);
  return merged;
}

async function loadCanonicalModule(path: Str, state: LoadState): Promise<Program> {
  if (isCHeaderPath(path)) return await loadHeaderModule(path, state.config);
  const source = await Deno.readTextFile(path);
  const local = parse(lex(source));
  const imported = await collectImports(path, local, state);
  return mergeProgram(local, imported);
}

async function loadHeaderModule(path: Str, config: ProjectConfig): Promise<Program> {
  const source = await generateExternsFromHeader(path, config.compilerFlags, config.projectDir);
  return exportAll(parse(lex(source)));
}

function exportAll(program: Program): Program {
  return { ...program, functions: program.functions.map((fn) => ({ ...fn, exported: true })) };
}

function isCHeaderPath(path: Str): b8 {
  return path.endsWith(".h");
}

async function collectImports(path: Str, program: Program, state: LoadState): Promise<Program[]> {
  const programs: Program[] = [];
  for (const request of collectImportRequests(path, program, state.config)) {
    const imported = await loadModule(request.path, state);
    programs.push(selectImports(imported, [...request.names], request.span));
  }
  return programs;
}

function collectImportRequests(path: Str, program: Program, config: ProjectConfig): ImportRequest[] {
  const requests = new Map<Str, ImportRequest>();
  for (const importDecl of program.imports) {
    validateImportPath(importDecl.path, importDecl.span, config);
    const importedPath = resolveImportPath(path, importDecl.path, config);
    const request = requests.get(importedPath) ?? createImportRequest(importedPath, importDecl.span);
    for (const name of importDecl.names) request.names.add(name);
    requests.set(importedPath, request);
  }
  return [...requests.values()];
}

function createImportRequest(path: Str, span: Diagnostic["span"]): ImportRequest {
  return { path, names: new Set<Str>(), span };
}

function validateImportPath(path: Str, span: Diagnostic["span"], config: ProjectConfig): void {
  const dependency = isDependencyImportPath(path, config);
  if (!isRelativeImportPath(path) && !isStdImportPath(path) && !dependency) {
    throw new TypeCError([{ message: `Import path '${path}' must be relative, std, or a project dependency`, span }]);
  }
  if (!dependency && !path.endsWith(".tc")) throw new TypeCError([{ message: `Import path '${path}' must target a .tc file`, span }]);
  if (isStdImportPath(path) && hasParentTraversal(path)) throw new TypeCError([{ message: `Std import path '${path}' must stay within std`, span }]);
}

function isRelativeImportPath(path: Str): b8 {
  return path.startsWith("./") || path.startsWith("../");
}

function isStdImportPath(path: Str): b8 {
  return path.startsWith("std/");
}

function isDependencyImportPath(path: Str, config: ProjectConfig): b8 {
  return config.dependencies.has(path);
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

function resolveImportPath(fromPath: Str, importPath: Str, config: ProjectConfig): Str {
  const dependencyPath = config.dependencies.get(importPath);
  if (dependencyPath) return projectImportPath(config.projectDir, dependencyPath);
  if (isStdImportPath(importPath)) return stdImportPath(importPath);
  return normalizePath(new URL(importPath, fileDirectoryUrl(fromPath)).pathname);
}

function projectImportPath(projectDir: Str, importPath: Str): Str {
  if (importPath.startsWith("/")) return importPath;
  if (isStdImportPath(importPath)) return stdImportPath(importPath);
  return normalizePath(new URL(importPath, fileDirectoryUrl(`${projectDir}/project.json`)).pathname);
}

function stdImportPath(importPath: Str): Str {
  const modulePath = importPath.slice("std/".length);
  return fileUrlPath(new URL(`../std/${modulePath}`, import.meta.url));
}

function fileUrlPath(url: URL): Str {
  return decodeURIComponent(url.pathname);
}

function fileDirectoryUrl(path: Str): URL {
  const url = new URL(`file://${normalizePath(path)}`);
  return new URL("./", url);
}

async function canonicalModulePath(path: Str): Promise<Str> {
  try {
    return await Deno.realPath(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw new TypeCError([{ message: `Module not found '${path}'` }]);
    throw error;
  }
}

function normalizePath(path: Str): Str {
  return path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
}
