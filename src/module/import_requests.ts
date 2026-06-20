import type { Diagnostic } from "core/diagnostics.ts";
import type { Program } from "core/ast.ts";
import { validateImportPath } from "paths/imports.ts";
import { resolveModuleImportPath } from "module/paths.ts";
import type { ProjectConfig } from "project/config.ts";

type Str = string;

export interface ImportRequest {
  path: Str;
  names: Set<Str>;
  namespaces: Set<Str>;
  span: Diagnostic["span"];
}

export function collectImportRequests(
  path: Str,
  program: Program,
  config: ProjectConfig,
): ImportRequest[] {
  const requests = new Map<Str, ImportRequest>();
  for (const importDecl of program.imports) {
    validateImportPath(importDecl.path, importDecl.span, config);
    const importedPath = resolveModuleImportPath(path, importDecl.path, config);
    const request = requests.get(importedPath) ??
      createImportRequest(importedPath, importDecl.span);
    for (const name of importDecl.names) request.names.add(name);
    if (importDecl.namespace) request.namespaces.add(importDecl.namespace);
    requests.set(importedPath, request);
  }
  return [...requests.values()];
}

function createImportRequest(path: Str, span: Diagnostic["span"]): ImportRequest {
  return { path, names: new Set<Str>(), namespaces: new Set<Str>(), span };
}
