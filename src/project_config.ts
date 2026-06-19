import { parseJsonRecord, rejectUnknownJsonKeys } from "./json_config.ts";
import { directoryOf, normalizePath } from "./path.ts";
import { readProjectCompilerFlags } from "./project_compiler.ts";
import { readProjectDependencies } from "./project_dependencies.ts";

type Str = string;
type b8 = boolean;

export interface ProjectConfig {
  projectDir: Str;
  dependencies: Map<Str, Str>;
  compilerFlags: Str[];
}

export async function loadProjectConfig(entryPath: Str): Promise<ProjectConfig> {
  const projectDir = await findProjectDir(normalizePath(entryPath));
  if (!projectDir) return emptyProjectConfig(directoryOf(normalizePath(entryPath)));
  const text = await Deno.readTextFile(`${projectDir}/project.json`);
  return parseProjectConfig(text, projectDir);
}

export function parseProjectConfig(text: Str, projectDir: Str): ProjectConfig {
  const value = parseJsonRecord(text, "project.json is not valid JSON", "project.json must contain an object");
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

async function findProjectDir(entryPath: Str): Promise<Str | null> {
  let dir = directoryOf(entryPath);
  while (true) {
    if (await fileExists(`${dir}/project.json`)) return dir;
    const parent = directoryOf(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function fileExists(path: Str): Promise<b8> {
  try {
    const info = await Deno.stat(path);
    return info.isFile;
  } catch {
    return false;
  }
}


