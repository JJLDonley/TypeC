type Str = string;
type b8 = boolean;

export function isStdImportPath(path: Str): b8 {
  return path.startsWith("std/");
}

export function isRelativeImportPath(path: Str): b8 {
  return path.startsWith("./") || path.startsWith("../");
}

export function isTypeCImportFile(path: Str): b8 {
  return path.endsWith(".tc") || path.endsWith(".h");
}

export function isImportAliasFilePath(path: Str): b8 {
  return isTypeCImportFile(path);
}

export function isAbsolutePosixPath(path: Str): b8 {
  return path.startsWith("/");
}

export function hasUrlScheme(path: Str): b8 {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(path);
}
