import { parseJsonRecord, rejectUnknownJsonKeys } from "json/config.ts";
import { directoryOf, normalizePath } from "paths";
import { readProjectCompilerFlags } from "project/compiler.ts";
import { findProjectDir, projectConfigPath } from "project/discovery.ts";
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

export function parseProjectConfig(text: Str, projectDir: Str): ProjectConfig {
  const value = parseJsonRecord(
    text,
    "project.json is not valid JSON",
    "project.json must contain an object",
  );
  rejectUnknownJsonKeys("project.json", value, ["dependencies", "compiler"]);
  return {
    projectDir,
    dependencies: readProjectDependencies(value.dependencies),
    compilerFlags: readProjectCompilerFlags(value.compiler),
  };
}

function emptyProjectConfig(projectDir: Str): ProjectConfig {
  return { projectDir, dependencies: new Map<Str, Str>(), compilerFlags: [] };
}
