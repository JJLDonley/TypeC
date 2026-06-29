import { IMPORT_CYCLE, MODULE_NOT_FOUND } from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";
import { generateExternsFromHeaderSync } from "c/header/generator.ts";
import type { Program } from "core/ast.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { normalizePath } from "paths";
import { markHeaderModule } from "module/header_modules.ts";
import { collectImportRequests } from "module/import_requests.ts";
import { isCHeaderPath } from "module/paths.ts";
import {
  exportAllFunctions,
  mergeProgram,
  selectImports,
  selectNamespaceImports,
} from "module/programs.ts";
import type { ProjectConfig } from "project/config.ts";

type Str = string;

interface SyncLoadState {
  loaded: Map<Str, Program>;
  loading: Set<Str>;
  config: ProjectConfig;
  entryPath: Str;
  entryText: Str;
}

export function loadProgramWithEntryTextSync(
  entryPath: Str,
  entryText: Str,
  config: ProjectConfig,
): Program {
  const state: SyncLoadState = {
    loaded: new Map<Str, Program>(),
    loading: new Set<Str>(),
    config,
    entryPath: canonicalModulePathSync(normalizePath(entryPath)),
    entryText,
  };
  return loadModuleSync(normalizePath(entryPath), state);
}

function loadModuleSync(path: Str, state: SyncLoadState): Program {
  const canonicalPath = canonicalModulePathSync(path);
  const loaded = state.loaded.get(canonicalPath);
  if (loaded) return loaded;
  if (state.loading.has(canonicalPath)) {
    throw new TypeCError([{
      message: `Import cycle involving '${canonicalPath}'`,
      code: IMPORT_CYCLE,
    }]);
  }
  state.loading.add(canonicalPath);
  const merged = loadCanonicalModuleSync(canonicalPath, state);
  state.loading.delete(canonicalPath);
  state.loaded.set(canonicalPath, merged);
  return merged;
}

function loadCanonicalModuleSync(path: Str, state: SyncLoadState): Program {
  if (isCHeaderPath(path)) return loadHeaderModuleSync(path, state.config);
  const source = path === state.entryPath ? state.entryText : Deno.readTextFileSync(path);
  const local = parse(lex(source));
  const imported = collectImportsSync(path, local, state);
  return mergeProgram(local, imported);
}

function loadHeaderModuleSync(path: Str, config: ProjectConfig): Program {
  const source = generateExternsFromHeaderSync(path, config.compilerFlags, config.projectDir);
  return markHeaderModule(exportAllFunctions(parse(lex(source))));
}

function collectImportsSync(path: Str, program: Program, state: SyncLoadState): Program[] {
  const programs: Program[] = [];
  for (const request of collectImportRequests(path, program, state.config)) {
    const imported = loadModuleSync(request.path, state);
    programs.push(selectImports(imported, [...request.names.values()], request.span));
    for (const [namespace, members] of request.namespaces) {
      programs.push(selectNamespaceImports(imported, namespace, [...members]));
    }
  }
  return programs;
}

function canonicalModulePathSync(path: Str): Str {
  try {
    return Deno.realPathSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new TypeCError([{ message: `Module not found '${path}'`, code: MODULE_NOT_FOUND }]);
    }
    throw error;
  }
}
