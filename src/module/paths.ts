import { MODULE_NOT_FOUND } from "core/diagnostic_codes.ts";
import { isStdImportPath } from "paths/import_kinds.ts";
import { TypeCError } from "core/diagnostics.ts";
import { directoryOf, fileDirectoryUrl, fileUrlPath, normalizePath } from "paths";
import type { ProjectConfig } from "project/config.ts";

type Str = string;
type b8 = boolean;

export function resolveModuleImportPath(
  fromPath: Str,
  importPath: Str,
  config: ProjectConfig,
): Str {
  const dependency = dependencyImportPath(importPath, config);
  if (dependency !== null) return dependency;
  if (isStdImportPath(importPath)) return stdImportPath(importPath);
  return normalizePath(new URL(importPath, fileDirectoryUrl(fromPath)).pathname);
}

export async function canonicalModulePath(path: Str): Promise<Str> {
  try {
    return await Deno.realPath(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new TypeCError([{ message: `Module not found '${path}'`, code: MODULE_NOT_FOUND }]);
    }
    throw error;
  }
}

export function isCHeaderPath(path: Str): b8 {
  return path.endsWith(".h");
}

function dependencyImportPath(importPath: Str, config: ProjectConfig): Str | null {
  const exactPath = config.dependencies.get(importPath) ?? null;
  if (exactPath !== null) return projectImportPath(config.projectDir, exactPath);
  const match = dependencyPrefix(importPath, config.dependencies);
  if (match === null) return null;
  const suffix = importPath.slice(match.alias.length + 1);
  return projectPackageImportPath(config.projectDir, match.target, suffix);
}

function dependencyPrefix(importPath: Str, dependencies: Map<Str, Str>): DependencyMatch | null {
  let best: DependencyMatch | null = null;
  for (const [alias, target] of dependencies) {
    if (!importPath.startsWith(`${alias}/`)) continue;
    if (best === null || alias.length > best.alias.length) best = { alias, target };
  }
  return best;
}

function projectPackageImportPath(projectDir: Str, target: Str, suffix: Str): Str {
  const packageRoot = packageRootPath(projectDir, target);
  return normalizePath(
    new URL(typeCModulePath(suffix), fileDirectoryUrl(`${packageRoot}/mod.tc`)).pathname,
  );
}

function packageRootPath(projectDir: Str, target: Str): Str {
  return directoryOf(projectImportPath(projectDir, target));
}

function projectImportPath(projectDir: Str, importPath: Str): Str {
  if (importPath.startsWith("/")) return importPath;
  if (isStdImportPath(importPath)) return stdImportPath(importPath);
  return normalizePath(
    new URL(importPath, fileDirectoryUrl(`${projectDir}/project.json`)).pathname,
  );
}

function stdImportPath(importPath: Str): Str {
  const modulePath = importPath.slice("std/".length);
  return fileUrlPath(new URL(`../../std/${typeCModulePath(modulePath)}`, import.meta.url));
}

function typeCModulePath(path: Str): Str {
  if (path.endsWith(".tc") || path.endsWith(".h")) return path;
  return `${path}.tc`;
}

interface DependencyMatch {
  alias: Str;
  target: Str;
}
