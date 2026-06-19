type Str = string;
type b8 = boolean;

export function hasBackslash(path: Str): b8 {
  return path.includes("\\");
}

export function hasEncodedSeparator(path: Str): b8 {
  return /%(2f|5c)/i.test(path);
}

export function hasMalformedEncoding(path: Str): b8 {
  return path.split("/").some((segment) => decodedPathSegment(segment) === null);
}

export function hasEncodedDotSegment(path: Str): b8 {
  return path.split("/").some(isEncodedDotSegment);
}

export function decodedPathSegment(segment: Str): Str | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

function isEncodedDotSegment(segment: Str): b8 {
  const decoded = decodedPathSegment(segment);
  return decoded !== null && decoded !== segment && (decoded === "." || decoded === "..");
}
