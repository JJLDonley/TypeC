type Str = string;
type b8 = boolean;

export function headerCompilerFlags(flags: Str[], projectDir: Str): Str[] {
  return flags.filter(isHeaderCompilerFlag).map((flag) =>
    normalizeHeaderCompilerFlag(flag, projectDir)
  );
}

function isHeaderCompilerFlag(flag: Str): b8 {
  return flag.startsWith("-I") || flag.startsWith("-D") || flag.startsWith("-U") ||
    flag.startsWith("-isystem");
}

function normalizeHeaderCompilerFlag(flag: Str, projectDir: Str): Str {
  if (flag.startsWith("-I")) return normalizeJoinedPathFlag(flag, "-I", projectDir);
  if (flag.startsWith("-isystem")) return normalizeJoinedPathFlag(flag, "-isystem", projectDir);
  return flag;
}

function normalizeJoinedPathFlag(flag: Str, prefix: Str, projectDir: Str): Str {
  if (flag.length <= prefix.length) return flag;
  const path = flag.slice(prefix.length);
  if (path.startsWith("/")) return flag;
  return `${prefix}${projectDir}/${path}`;
}
