import type { Diagnostic } from "./diagnostics.ts";
import type { Program } from "./ast.ts";
import { validateImportPath } from "./import_paths.ts";
import { resolveModuleImportPath } from "./module_paths.ts";
import type { ProjectConfig } from "./project_config.ts";

type Str = string;

export interface ImportRequest {
  path: Str;
  names: Set<Str>;
  span: Diagnostic["span"];
}

export function collectImportRequests(path: Str, program: Program, config: ProjectConfig): ImportRequest[] {
  const requests = new Map<Str, ImportRequest>();
  for (const importDecl of program.imports) {
    validateImportPath(importDecl.path, importDecl.span, config);
    const importedPath = resolveModuleImportPath(path, importDecl.path, config);
    const request = requests.get(importedPath) ?? createImportRequest(importedPath, importDecl.span);
    for (const name of importDecl.names) request.names.add(name);
    requests.set(importedPath, request);
  }
  return [...requests.values()];
}

function createImportRequest(path: Str, span: Diagnostic["span"]): ImportRequest {
  return { path, names: new Set<Str>(), span };
}
