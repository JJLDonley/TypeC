import { isStdImportPath } from "./import_path_kinds.ts";
import { TypeCError } from "./diagnostics.ts";
import { fileDirectoryUrl, fileUrlPath, normalizePath } from "./path.ts";
import type { ProjectConfig } from "./project_config.ts";

type Str = string;
type b8 = boolean;

export function resolveModuleImportPath(fromPath: Str, importPath: Str, config: ProjectConfig): Str {
  const dependencyPath = config.dependencies.get(importPath);
  if (dependencyPath) return projectImportPath(config.projectDir, dependencyPath);
  if (isStdImportPath(importPath)) return stdImportPath(importPath);
  return normalizePath(new URL(importPath, fileDirectoryUrl(fromPath)).pathname);
}

export async function canonicalModulePath(path: Str): Promise<Str> {
  try {
    return await Deno.realPath(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) throw new TypeCError([{ message: `Module not found '${path}'` }]);
    throw error;
  }
}

export function isCHeaderPath(path: Str): b8 {
  return path.endsWith(".h");
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
