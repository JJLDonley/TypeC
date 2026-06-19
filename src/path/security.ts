type Str = string;
type b8 = boolean;

export function hasParentTraversal(path: Str): b8 {
  return normalizedPathSeparators(decodedPath(path)).split("/").some(isParentSegment);
}

function normalizedPathSeparators(path: Str): Str {
  return path.replaceAll("\\", "/");
}

function decodedPath(path: Str): Str {
  try {
    return decodeURIComponent(path);
  } catch {
    return "..";
  }
}

function isParentSegment(segment: Str): b8 {
  return segment === "..";
}
