import { TypeCError } from "core/diagnostics.ts";
import { generateExternsFromHeader } from "c/header/generator.ts";
import type { Program } from "core/ast.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { normalizePath } from "paths";
import { collectImportRequests } from "module/import_requests.ts";
import { canonicalModulePath, isCHeaderPath } from "module/paths.ts";
import {
  exportAllFunctions,
  mergeProgram,
  selectImports,
  selectNamespaceImports,
} from "module/programs.ts";
import { loadProjectConfig, type ProjectConfig } from "project/config.ts";

type Str = string;

interface LoadState {
  loaded: Map<Str, Program>;
  loading: Set<Str>;
  config: ProjectConfig;
}

export async function loadProgram(
  entryPath: Str,
  config: ProjectConfig | null = null,
): Promise<Program> {
  const resolvedConfig = config ?? await loadProjectConfig(entryPath);
  const state = {
    loaded: new Map<Str, Program>(),
    loading: new Set<Str>(),
    config: resolvedConfig,
  };
  return await loadModule(normalizePath(entryPath), state);
}

async function loadModule(path: Str, state: LoadState): Promise<Program> {
  const canonicalPath = await canonicalModulePath(path);
  const loaded = state.loaded.get(canonicalPath);
  if (loaded) return loaded;
  if (state.loading.has(canonicalPath)) {
    throw new TypeCError([{ message: `Import cycle involving '${canonicalPath}'` }]);
  }

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
  return exportAllFunctions(parse(lex(source)));
}

async function collectImports(path: Str, program: Program, state: LoadState): Promise<Program[]> {
  const programs: Program[] = [];
  for (const request of collectImportRequests(path, program, state.config)) {
    const imported = await loadModule(request.path, state);
    programs.push(selectImports(imported, [...request.names], request.span));
    for (const namespace of request.namespaces) {
      programs.push(selectNamespaceImports(imported, namespace));
    }
  }
  return programs;
}
