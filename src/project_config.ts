import { compilerFlagError } from "./compiler_flags.ts";
import { TypeCError } from "./diagnostics.ts";
import { type JsonRecord, isJsonRecord } from "./json_record.ts";
import { directoryOf, normalizePath } from "./path.ts";
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
  const value = parseJson(text);
  if (!isJsonRecord(value)) throw configError("project.json must contain an object");
  rejectUnknownKeys("project.json", value, ["dependencies", "compiler"]);
  return {
    projectDir,
    dependencies: readProjectDependencies(value.dependencies),
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

function readCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isJsonRecord(value)) throw configError("project.json compiler must be an object");
  rejectUnknownKeys("project.json compiler", value, ["flags"]);
  const flags = value.flags;
  if (flags === undefined) return [];
  if (!Array.isArray(flags) || !flags.every((flag) => typeof flag === "string")) throw configError("project.json compiler.flags must be a string array");
  for (const flag of flags) validateCompilerFlag(flag);
  return flags;
}

function validateCompilerFlag(flag: Str): void {
  const message = compilerFlagError(flag);
  if (message !== null) throw configError(message);
}

function rejectUnknownKeys(scope: Str, value: JsonRecord, knownKeys: Str[]): void {
  const known = new Set<Str>(knownKeys);
  for (const key of Object.keys(value)) {
    if (!known.has(key)) throw configError(`${scope} has unknown key '${key}'`);
  }
}

function configError(message: Str): TypeCError {
  return new TypeCError([{ message }]);
}

