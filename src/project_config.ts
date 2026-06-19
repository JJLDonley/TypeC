import { TypeCError } from "./diagnostics.ts";

type Str = string;
type b8 = boolean;

type JsonRecord = Record<Str, unknown>;

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
  const value = parseJson(text);
  if (!isRecord(value)) throw configError("project.json must contain an object");
  return {
    projectDir,
    dependencies: readDependencies(value.dependencies),
    compilerFlags: readCompilerFlags(value.compiler),
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

function parseJson(text: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw configError("project.json is not valid JSON");
  }
}

function readDependencies(value: unknown): Map<Str, Str> {
  const dependencies = new Map<Str, Str>();
  if (value === undefined) return dependencies;
  if (!isRecord(value)) throw configError("project.json dependencies must be an object");
  for (const [name, path] of Object.entries(value)) {
    if (typeof path !== "string") throw configError(`Dependency '${name}' must map to a string path`);
    dependencies.set(name, path);
  }
  return dependencies;
}

function readCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isRecord(value)) throw configError("project.json compiler must be an object");
  const flags = value.flags;
  if (flags === undefined) return [];
  if (!Array.isArray(flags) || !flags.every((flag) => typeof flag === "string")) throw configError("project.json compiler.flags must be a string array");
  return flags;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configError(message: Str): TypeCError {
  return new TypeCError([{ message }]);
}

function normalizePath(path: Str): Str {
  return path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
}

function directoryOf(path: Str): Str {
  const normalized = stripTrailingSlash(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "/";
  return normalized.slice(0, index);
}

function stripTrailingSlash(path: Str): Str {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}
