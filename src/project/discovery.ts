import { directoryOf, normalizePath } from "paths";

type Str = string;
type b8 = boolean;

export async function findProjectDir(entryPath: Str): Promise<Str | null> {
  let dir = directoryOf(normalizePath(entryPath));
  while (true) {
    if (await isProjectDir(dir)) return dir;
    const parent = directoryOf(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function findProjectDirSync(entryPath: Str): Str | null {
  let dir = directoryOf(normalizePath(entryPath));
  while (true) {
    if (isProjectDirSync(dir)) return dir;
    const parent = directoryOf(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function projectConfigPath(projectDir: Str): Str {
  return `${projectDir}/project.json`;
}

async function isProjectDir(dir: Str): Promise<b8> {
  return await fileExists(projectConfigPath(dir));
}

async function fileExists(path: Str): Promise<b8> {
  try {
    const info = await Deno.stat(path);
    return info.isFile;
  } catch {
    return false;
  }
}

function isProjectDirSync(dir: Str): b8 {
  return fileExistsSync(projectConfigPath(dir));
}

function fileExistsSync(path: Str): b8 {
  try {
    const info = Deno.statSync(path);
    return info.isFile;
  } catch {
    return false;
  }
}
