import { TypeCError } from "./diagnostics.ts";
import { hasParentTraversal } from "./path_security.ts";

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
  rejectUnknownKeys("project.json", value, ["dependencies", "compiler"]);
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
    validateDependencyAlias(name);
    if (typeof path !== "string") throw configError(`Dependency '${name}' must map to a string path`);
    validateDependencyTarget(name, path);
    dependencies.set(name, path);
  }
  return dependencies;
}

function validateDependencyAlias(name: Str): void {
  if (isRelativeImportPath(name) || isStdImportPath(name)) throw configError(`Dependency alias '${name}' must not be relative or std`);
  if (!hasValidAliasSegments(name) || hasBackslash(name) || isAbsolutePath(name) || hasUrlScheme(name) || hasParentTraversal(name)) throw configError(`Dependency alias '${name}' must be a project dependency import path`);
  if (isAliasFilePath(name)) throw configError(`Dependency alias '${name}' must not include a file extension`);
}

function hasValidAliasSegments(path: Str): b8 {
  return path.length > 0 && path.split("/").every(isValidAliasSegment);
}

function isValidAliasSegment(segment: Str): b8 {
  return segment.length > 0 && segment !== ".";
}

function isAliasFilePath(path: Str): b8 {
  return path.endsWith(".tc") || path.endsWith(".h");
}

function hasBackslash(path: Str): b8 {
  return path.includes("\\");
}

function validateDependencyTarget(name: Str, path: Str): void {
  if (!isDependencyTargetFile(path)) throw configError(`Dependency '${name}' target must be a .tc or .h file`);
  if (hasUrlScheme(path)) throw configError(`Dependency '${name}' target must be a local dependency path`);
  if (isStdImportPath(path) && hasParentTraversal(path)) throw configError(`Dependency '${name}' std target must stay within std`);
  if (isProjectRelativeTarget(path) && hasParentTraversal(path)) throw configError(`Dependency '${name}' target must stay within the project`);
}

function isDependencyTargetFile(path: Str): b8 {
  return path.endsWith(".tc") || path.endsWith(".h");
}

function isProjectRelativeTarget(path: Str): b8 {
  return !isAbsolutePath(path) && !isStdImportPath(path);
}

function isAbsolutePath(path: Str): b8 {
  return path.startsWith("/");
}

function hasUrlScheme(path: Str): b8 {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path);
}

function isRelativeImportPath(path: Str): b8 {
  return path.startsWith("./") || path.startsWith("../");
}

function isStdImportPath(path: Str): b8 {
  return path.startsWith("std/");
}

function readCompilerFlags(value: unknown): Str[] {
  if (value === undefined) return [];
  if (!isRecord(value)) throw configError("project.json compiler must be an object");
  rejectUnknownKeys("project.json compiler", value, ["flags"]);
  const flags = value.flags;
  if (flags === undefined) return [];
  if (!Array.isArray(flags) || !flags.every((flag) => typeof flag === "string")) throw configError("project.json compiler.flags must be a string array");
  for (const flag of flags) validateCompilerFlag(flag);
  return flags;
}

function validateCompilerFlag(flag: Str): void {
  if (!flag.startsWith("-")) throw configError("project.json compiler.flags must contain flags only");
  if (flag === "-std" || flag.startsWith("-std=")) throw configError("project.json compiler.flags cannot override the C standard");
  if (flag === "-o" || flag.startsWith("-o")) throw configError("project.json compiler.flags cannot override output paths");
  if (isArtifactModeFlag(flag)) throw configError("project.json compiler.flags cannot change build artifact mode");
  if (isSeparateOperandFlag(flag)) throw configError(`project.json compiler flag '${flag}' must include its operand in the same argument`);
  if (flag === "-x") throw configError("project.json compiler.flags cannot override input language");
}

function isArtifactModeFlag(flag: Str): b8 {
  return flag === "-c" || flag === "-E" || flag === "-S" || flag === "-shared";
}

function isSeparateOperandFlag(flag: Str): b8 {
  return flag === "-I" || flag === "-D" || flag === "-U" || flag === "-L" || flag === "-l" || flag === "-include" || flag === "-isystem";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
