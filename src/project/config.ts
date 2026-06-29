import { JSON_INVALID, JSON_RECORD_REQUIRED, JSON_UNKNOWN_KEY } from "core/diagnostic_codes.ts";
import { parseJsonRecord, rejectUnknownJsonKeys } from "json/config.ts";
import { directoryOf, normalizePath } from "paths";
import { readProjectCompilerFlags } from "project/compiler.ts";
import { findProjectDir, findProjectDirSync, projectConfigPath } from "project/discovery.ts";
import { readProjectDependencies } from "project/dependencies.ts";

type Str = string;

export interface ProjectConfig {
  projectDir: Str;
  dependencies: Map<Str, Str>;
  compilerFlags: Str[];
}

export async function loadProjectConfig(entryPath: Str): Promise<ProjectConfig> {
  const projectDir = await findProjectDir(normalizePath(entryPath));
  if (!projectDir) return emptyProjectConfig(directoryOf(normalizePath(entryPath)));
  const text = await Deno.readTextFile(projectConfigPath(projectDir));
  return parseProjectConfig(text, projectDir);
}

export function loadProjectConfigSync(entryPath: Str): ProjectConfig {
  const projectDir = findProjectDirSync(normalizePath(entryPath));
  if (!projectDir) return emptyProjectConfig(directoryOf(normalizePath(entryPath)));
  return parseProjectConfig(Deno.readTextFileSync(projectConfigPath(projectDir)), projectDir);
}

export function parseProjectConfig(text: Str, projectDir: Str): ProjectConfig {
  const value = parseJsonRecord(
    text,
    "project.json is not valid JSON",
    "project.json must contain an object",
    JSON_INVALID,
    JSON_RECORD_REQUIRED,
  );
  rejectUnknownJsonKeys("project.json", value, ["dependencies", "compiler"], JSON_UNKNOWN_KEY);
  return {
    projectDir,
    dependencies: readProjectDependencies(value.dependencies),
    compilerFlags: readProjectCompilerFlags(value.compiler),
  };
}

function emptyProjectConfig(projectDir: Str): ProjectConfig {
  return { projectDir, dependencies: new Map<Str, Str>(), compilerFlags: [] };
}
