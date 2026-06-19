import type { Diagnostic } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { FunctionDecl, Program, TypeAliasDecl } from "./ast.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";

type Str = string;

interface LoadState {
  loaded: Map<Str, Program>;
  loading: Set<Str>;
}

export async function loadProgram(entryPath: Str): Promise<Program> {
  const state = { loaded: new Map<Str, Program>(), loading: new Set<Str>() };
  return await loadModule(normalizePath(entryPath), state);
}

async function loadModule(path: Str, state: LoadState): Promise<Program> {
  const loaded = state.loaded.get(path);
  if (loaded) return loaded;
  if (state.loading.has(path)) throw new TypeCError([{ message: `Import cycle involving '${path}'` }]);

  state.loading.add(path);
  const source = await Deno.readTextFile(path);
  const local = parse(lex(source));
  const imported = await collectImports(path, local, state);
  const merged = mergeProgram(local, imported);
  state.loading.delete(path);
  state.loaded.set(path, merged);
  return merged;
}

async function collectImports(path: Str, program: Program, state: LoadState): Promise<Program[]> {
  const programs: Program[] = [];
  for (const importDecl of program.imports) {
    const importedPath = resolveImportPath(path, importDecl.path);
    const imported = await loadModule(importedPath, state);
    programs.push(selectImports(imported, importDecl.names, importDecl.span));
  }
  return programs;
}

function mergeProgram(local: Program, imports: Program[]): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: [...imports.flatMap((program) => program.typeAliases), ...local.typeAliases],
    functions: [...imports.flatMap((program) => program.functions), ...local.functions],
    span: local.span,
  };
}

function selectImports(program: Program, names: Str[], span: Diagnostic["span"]): Program {
  const typeAliases = names.flatMap((name) => selectTypeAlias(program.typeAliases, name));
  const functions = names.flatMap((name) => selectFunction(program.functions, name));
  const found = new Set<Str>([...typeAliases.map((decl) => decl.name), ...functions.map((decl) => decl.name)]);
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) throw new TypeCError(missing.map((name) => ({ message: `Module does not export '${name}'`, span })));
  return { kind: "Program", imports: [], typeAliases, functions, span: program.span };
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

function normalizePath(path: Str): Str {
  return path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
}
