type Str = string;
type b8 = boolean;

export function normalizePath(path: Str): Str {
  return path.startsWith("/") ? path : `${Deno.cwd()}/${path}`;
}

export function basenameNoExt(path: Str): Str {
  const file = path.split(/[\\/]/).pop() ?? "out";
  return file.replace(/\.[^.]+$/, "");
}

export function buildOutputPaths(inputPath: Str, buildDir: Str): { cPath: Str; exePath: Str } {
  const base = basenameNoExt(inputPath);
  return { cPath: `${buildDir}/${base}.c`, exePath: `${buildDir}/${base}` };
}

export function directoryOf(path: Str): Str {
  const normalized = stripTrailingSlash(path);
  const index = normalized.lastIndexOf("/");
  if (index <= 0) return "/";
  return normalized.slice(0, index);
}

export function stripTrailingSlash(path: Str): Str {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function isPathWithinDir(path: Str, dir: Str): b8 {
  const normalizedDir = stripTrailingSlash(dir);
  return path === normalizedDir || path.startsWith(`${normalizedDir}/`);
}
