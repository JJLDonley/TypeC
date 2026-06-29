import { DUPLICATE_IMPORT_ALIAS } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { ImportSpecifier, Program } from "core/ast.ts";
import { validateImportPath } from "paths/imports.ts";
import { collectNamespaceMembers } from "module/namespace_usage.ts";
import { resolveModuleImportPath } from "module/paths.ts";
import type { ProjectConfig } from "project/config.ts";

type Str = string;

export interface ImportRequest {
  path: Str;
  names: Map<Str, ImportSpecifier>;
  namespaces: Map<Str, Set<Str>>;
  span: Diagnostic["span"];
}

export function collectImportRequests(
  path: Str,
  program: Program,
  config: ProjectConfig,
): ImportRequest[] {
  const requests = new Map<Str, ImportRequest>();
  for (const importDecl of program.imports) {
    collectImportDeclRequest(path, program, config, requests, importDecl);
  }
  for (const exportDecl of program.exports ?? []) {
    if (exportDecl.path !== null) collectExportDeclRequest(path, config, requests, exportDecl);
  }
  return [...requests.values()];
}

function collectImportDeclRequest(
  path: Str,
  program: Program,
  config: ProjectConfig,
  requests: Map<Str, ImportRequest>,
  importDecl: Program["imports"][number],
): void {
  validateImportPath(importDecl.path, importDecl.span, config);
  const importedPath = resolveModuleImportPath(path, importDecl.path, config);
  const request = requests.get(importedPath) ?? createImportRequest(importedPath, importDecl.span);
  for (const name of importDecl.names) addNamedRequest(request, name, importDecl.span);
  if (importDecl.namespace) {
    request.namespaces.set(
      importDecl.namespace,
      collectNamespaceMembers(program, importDecl.namespace),
    );
  }
  requests.set(importedPath, request);
}

function collectExportDeclRequest(
  path: Str,
  config: ProjectConfig,
  requests: Map<Str, ImportRequest>,
  exportDecl: NonNullable<Program["exports"]>[number],
): void {
  const exportPath = exportDecl.path ?? "";
  validateImportPath(exportPath, exportDecl.span, config);
  const importedPath = resolveModuleImportPath(path, exportPath, config);
  const request = requests.get(importedPath) ?? createImportRequest(importedPath, exportDecl.span);
  for (const name of exportDecl.names) addNamedRequest(request, name, exportDecl.span);
  requests.set(importedPath, request);
}

function addNamedRequest(
  request: ImportRequest,
  specifier: ImportSpecifier,
  span: Diagnostic["span"],
): void {
  const duplicate = [...request.names.values()].find((candidate) =>
    candidate.local === specifier.local && candidate.imported !== specifier.imported
  );
  if (duplicate) {
    throw new TypeCError([{
      message: `Duplicate import alias '${specifier.local}'`,
      code: DUPLICATE_IMPORT_ALIAS,
      span,
    }]);
  }
  request.names.set(importSpecifierKey(specifier), specifier);
}

function createImportRequest(path: Str, span: Diagnostic["span"]): ImportRequest {
  return {
    path,
    names: new Map<Str, ImportSpecifier>(),
    namespaces: new Map<Str, Set<Str>>(),
    span,
  };
}

function importSpecifierKey(specifier: ImportSpecifier): Str {
  return `${specifier.imported}\u0000${specifier.local}`;
}
