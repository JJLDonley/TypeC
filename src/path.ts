type Str = string;

export function basenameNoExt(path: Str): Str {
  const file = path.split(/[\\/]/).pop() ?? "out";
  return file.replace(/\.[^.]+$/, "");
}

export function buildOutputPaths(inputPath: Str, buildDir: Str): { cPath: Str; exePath: Str } {
  const base = basenameNoExt(inputPath);
  return { cPath: `${buildDir}/${base}.c`, exePath: `${buildDir}/${base}` };
}
