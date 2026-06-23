import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import {
  hasBackslash,
  hasEncodedDotSegment,
  hasEncodedSeparator,
  hasMalformedEncoding,
} from "paths/encoding.ts";
import { isRelativeImportPath, isStdImportPath, isTypeCImportFile } from "paths/import_kinds.ts";
import { hasParentTraversal } from "paths/security.ts";
import type { ProjectConfig } from "project/config.ts";

type Str = string;
type b8 = boolean;

export function validateImportPath(
  path: Str,
  span: Diagnostic["span"],
  config: ProjectConfig,
): void {
  if (hasBackslash(path) || hasEncodedSeparator(path)) {
    throw importPathError(path, "must use / separators", span);
  }
  if (hasMalformedEncoding(path)) {
    throw importPathError(path, "contains invalid percent encoding", span);
  }
  if (hasEncodedDotSegment(path)) {
    throw importPathError(path, "must not contain encoded path segments", span);
  }
  const dependency = isDependencyImportPath(path, config);
  if (!isRelativeImportPath(path) && !isStdImportPath(path) && !dependency) {
    throw importPathError(path, "must be relative, std, or a project dependency", span);
  }
  if (!dependency && !isTypeCImportFile(path)) {
    throw importPathError(path, "must target a .tc or .h file", span);
  }
  if (isStdImportPath(path) && hasParentTraversal(path)) {
    throw new TypeCError([{ message: `Std import path '${path}' must stay within std`, span }]);
  }
}

export { isStdImportPath } from "paths/import_kinds.ts";

export function isDependencyImportPath(path: Str, config: ProjectConfig): b8 {
  return config.dependencies.has(path);
}

function importPathError(path: Str, reason: Str, span: Diagnostic["span"]): TypeCError {
  return new TypeCError([{ message: `Import path '${path}' ${reason}`, span }]);
}
