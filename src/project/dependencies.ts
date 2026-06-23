import { TypeCError } from "core/diagnostics.ts";
import {
  hasUrlScheme,
  isAbsolutePosixPath,
  isImportAliasFilePath,
  isRelativeImportPath,
  isStdImportPath,
  isTypeCImportFile,
} from "paths/import_kinds.ts";
import { isJsonRecord, type JsonRecord } from "json/record.ts";
import { decodedPathSegment, hasBackslash, hasEncodedSeparator } from "paths/encoding.ts";
import { hasParentTraversal } from "paths/security.ts";

type Str = string;
type b8 = boolean;

export function readProjectDependencies(value: unknown): Map<Str, Str> {
  const dependencies = new Map<Str, Str>();
  if (value === undefined) return dependencies;
  if (!isJsonRecord(value)) throw dependencyError("project.json dependencies must be an object");
  for (const [name, path] of Object.entries(value)) addDependency(dependencies, name, path);
  return dependencies;
}

function addDependency(dependencies: Map<Str, Str>, name: Str, path: unknown): void {
  validateDependencyAlias(name);
  if (typeof path !== "string") {
    throw dependencyError(`Dependency '${name}' must map to a string path`);
  }
  validateDependencyTarget(name, path);
  dependencies.set(name, path);
}

function validateDependencyAlias(name: Str): void {
  if (isRelativeImportPath(name) || isStdImportPath(name)) {
    throw dependencyError(`Dependency alias '${name}' must not be relative or std`);
  }
  if (
    !hasValidAliasSegments(name) || hasBackslash(name) || isAbsolutePosixPath(name) ||
    hasUrlScheme(name) || hasParentTraversal(name)
  ) throw dependencyError(`Dependency alias '${name}' must be a project dependency import path`);
  if (isImportAliasFilePath(name)) {
    throw dependencyError(`Dependency alias '${name}' must not include a file extension`);
  }
}

function hasValidAliasSegments(path: Str): b8 {
  return path.length > 0 && path.split("/").every(isValidAliasSegment);
}

function isValidAliasSegment(segment: Str): b8 {
  const decoded = decodedAliasSegment(segment);
  return segment.length > 0 && decoded !== null && decoded.length > 0 && decoded !== "." &&
    !decoded.includes("/") && !decoded.includes("\\");
}

function decodedAliasSegment(segment: Str): Str | null {
  return decodedPathSegment(segment);
}

function validateDependencyTarget(name: Str, path: Str): void {
  if (!isTypeCImportFile(path)) {
    throw dependencyError(`Dependency '${name}' target must be a .tc or .h file`);
  }
  if (hasUrlScheme(path) || hasBackslash(path) || hasEncodedSeparator(path)) {
    throw dependencyError(`Dependency '${name}' target must be a local dependency path`);
  }
  if (isStdImportPath(path) && hasParentTraversal(path)) {
    throw dependencyError(`Dependency '${name}' std target must stay within std`);
  }
  if (isProjectRelativeTarget(path) && hasParentTraversal(path)) {
    throw dependencyError(`Dependency '${name}' target must stay within the project`);
  }
}

function isProjectRelativeTarget(path: Str): b8 {
  return !isAbsolutePosixPath(path) && !isStdImportPath(path);
}

function dependencyError(message: Str): TypeCError {
  return new TypeCError([{ message }]);
}
